import { Injectable, type OnModuleInit, Optional } from "@nestjs/common";
import type {
  Approval,
  AutopilotLocation,
  Goal,
  GoalAction,
  GoalMessage,
  GoalState,
  Integration,
} from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { ApprovalsService, type ResumableRunner } from "../approvals/approvals.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { AdapterRegistry } from "../channels/adapters/adapter-registry";
import { InboxPrThreadsService } from "../inbox/inbox-pr-threads.service";
import { prLocationOf } from "../inbox/pr-automation.service";
import { CredentialsStore } from "../integrations/credentials.store";
import { IntegrationsStorageService } from "../integrations/integrations.storage.service";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { ResolvedProjectService } from "../projects/resolved-project.service";
import { LoggerService, type ScopedLogger } from "../shared/logging/logger.service";
import {
  type GoalActionContext,
  GoalActionExecutor,
  addWaits,
  keepEarlierWake,
  reportFromGoal,
} from "./goal-action-executor";
import { isWorkingHours, nextWorkingStart } from "./goal-cadence";
import type { GoalFactsContext, GoalFactsSource } from "./goal-facts";
import { PrFactsSource } from "./goal-facts-sources";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

type MessageAction = Extract<GoalAction, { type: "message" }>;
type Target = GoalMessage["target"];

/** Anti-nagging: messages per person per goal cycle (sent + pending drafts). */
export const MESSAGES_PER_PERSON = 2;
/** The effective `autoCommunicate` the planner is told: `paused` = Autopilot paused. */
export type CommunicationLevel = "manual" | "semi" | "auto" | "paused";

const SLACK_USER_ID = /^[UW][A-Z0-9]{2,}$/;
/** Text that is not a real message (DNA: a reply is concrete or it is not drafted). */
const PLACEHOLDER =
  /\b(TODO|TBD|FIXME|XXX|lorem ipsum)\b|\{\{|\[(name|jméno|text|zpráva|message)\]|<(name|jméno|text|zpráva|message)>/i;
const MIN_TEXT = 8;
/** `@login` mentions (an email's `@` is preceded by a word character and does not count). */
const MENTION = /(?<![\w.])@([A-Za-z0-9][\w.-]*)/g;
const ERROR_MAX = 300;
/** A remote display name embedded in facts and approvals is capped (remote-controlled text). */
const NAME_MAX = 80;
/** A transient Slack lookup failure is retried this soon (not recorded as applied). */
const RETRY_MS = 15 * 60 * 1000;

/**
 * The goal engine's `message` action (spec "Closed action set", "Anti-nagging", "Rulings →
 * Messages"): ZIBBY asks a colleague for something as the operator.
 *
 * - **Concrete or not drafted:** a placeholder text or a recipient that does not resolve is a
 *   report to the operator; no approval is created.
 * - **Closed recipients:** `slack-user` must be a real user (`users.info`) of a Slack account
 *   serving the instance (the project's accounts; a `_` instance: the operator's personal ones)
 *   and is sent as a DM; `pr` must be the author or a reviewer of a PR inside the instance's
 *   scope and is posted as a PR comment that mentions them. No other mention may be in the text.
 * - **Anti-nagging** (enforced here, not by the planner): Mon–Fri 9–17 Prague, else deferred
 *   with `wakeAt` and NOT recorded as applied (re-planned then); at most
 *   {@link MESSAGES_PER_PERSON} per person per cycle, pending drafts included, else a report.
 * - **Tier:** sent at once (act, then report) only when `autoCommunicate` is `auto` at the
 *   instance's place, Autopilot is not paused, and the recipient is known to the goal (a PR
 *   author/reviewer, or a Slack id named in the goal definition or in this instance's own
 *   facts); otherwise a `goal-message` approval. The goal's ceiling (tier2, checked by the
 *   executor) is necessary, never sufficient.
 * - **Exactly once:** the draft record and the applied `actionId` land in one state write; a
 *   send first flips the record to `sending` under the lock, so an approve, a restart or a
 *   re-tick never sends twice (a crash mid-send leaves it `sending`: never re-sent).
 */
@Injectable()
export class GoalMessageService implements OnModuleInit, ResumableRunner, GoalFactsSource {
  readonly name = "messages";
  private readonly log?: ScopedLogger;

  constructor(
    private readonly executor: GoalActionExecutor,
    private readonly approvals: ApprovalsService,
    private readonly store: GoalStateStore,
    private readonly goals: GoalsStorageService,
    private readonly autopilot: AutopilotService,
    private readonly projects: ProjectsStorageService,
    private readonly resolvedProjects: ResolvedProjectService,
    private readonly integrations: IntegrationsStorageService,
    private readonly credentials: CredentialsStore,
    private readonly adapters: AdapterRegistry,
    private readonly prs: PrFactsSource,
    private readonly prThreads: InboxPrThreadsService,
    private readonly activity: ActivityLogService,
    @Optional() logger?: LoggerService,
  ) {
    this.log = logger?.child(GoalMessageService.name);
  }

  onModuleInit(): void {
    this.executor.register("message", (a, ctx) => this.handle(a, ctx));
    this.approvals.register("goal-message", this);
  }

  /** The effective `autoCommunicate` at the instance's place (`_` → global). */
  async communicationLevel(goal: Goal, instanceKey: string): Promise<CommunicationLevel> {
    if (this.autopilot.isPaused()) return "paused";
    return this.autopilot.levelsAt(await this.placeOf(instanceKey)).autoCommunicate;
  }

  private async placeOf(instanceKey: string): Promise<AutopilotLocation> {
    if (instanceKey === "_") return {};
    return prLocationOf(this.projects, this.resolvedProjects, instanceKey);
  }

  // ---- the action ----

  private async handle(a: MessageAction, ctx: GoalActionContext): Promise<void> {
    const notDone = async (why: string) => {
      // Recorded as applied: restating the same action re-notifies nobody.
      await this.markApplied(ctx, a.actionId);
      reportFromGoal(ctx, `Zpráva nenapsána (${a.actionId}): ${why}`);
    };
    const text = a.text.trim();
    if (text.length < MIN_TEXT || PLACEHOLDER.test(text)) {
      return notDone("text není konkrétní zpráva.");
    }
    const resolved = await this.resolve(a, ctx);
    if (typeof resolved === "string") return notDone(resolved);
    if ("retry" in resolved) {
      // Transient: not applied, so the next plan may restate it.
      keepEarlierWake(ctx.instance, new Date(ctx.now.getTime() + RETRY_MS).toISOString());
      ctx.timeline("note", `Zpráva (${a.actionId}) odložena: ${resolved.retry}`);
      return;
    }
    const { target, person, to } = resolved;
    const mentionError = foreignMention(target, text);
    if (mentionError) return notDone(mentionError);

    if (!isWorkingHours(ctx.now)) {
      const at = nextWorkingStart(ctx.now);
      keepEarlierWake(ctx.instance, at.toISOString());
      ctx.timeline(
        "note",
        `Zpráva pro ${to} odložena na ${PRAGUE.format(at)} (mimo pracovní dobu).`,
      );
      return;
    }

    const capped = `${to} už v tomto cyklu dostal(a) ${MESSAGES_PER_PERSON} zprávy — další je na tobě.`;
    const state = await this.store.read(ctx.goal.id, ctx.goal.createdAt);
    if (used(state, person) >= MESSAGES_PER_PERSON) return notDone(capped);
    // Re-checked under the lock: a parallel approve/plan may have used the slot meanwhile.
    let overCap = false;
    const push = (m: GoalMessage) => (s: GoalState) => {
      if (used(s, person) >= MESSAGES_PER_PERSON) overCap = true;
      else (s.messages ??= []).push(m);
    };

    const message: GoalMessage = {
      id: `${ctx.instanceKey}/${a.actionId}`,
      instance: ctx.instanceKey,
      actionId: a.actionId,
      person,
      to,
      status: "pending",
      text,
      target,
      createdAt: ctx.now.toISOString(),
    };
    const level = await this.communicationLevel(ctx.goal, ctx.instanceKey);
    if (level !== "auto" || !knownRecipient(ctx, target)) {
      const approval = await this.approvals.requestApproval({
        runId: `${ctx.goal.id}/${message.id}`,
        kind: "goal-message",
        skill: "goal",
        action: "message.send",
        detail: approvalDetail(ctx.label, message),
        risk: "medium",
        ...(target.kind === "pr" ? { sourceUrl: await this.prUrl(target) } : {}),
      });
      const stored = await this.commit(
        ctx,
        state.cycle.index,
        a.actionId,
        push({ ...message, approvalId: approval.id }),
      );
      if (!stored || overCap) {
        await this.approvals.reject(approval.id, "koncept neuložen").catch(() => undefined);
        if (overCap) reportFromGoal(ctx, `Zpráva nenapsána (${a.actionId}): ${capped}`);
        return;
      }
      addWaits(ctx.instance, [{ kind: "approval", ref: approval.id }]);
      ctx.timeline("message-drafted", `Zpráva pro ${to} čeká na schválení.`, {
        approvalId: approval.id,
      });
      return;
    }

    // Auto: claim it as `sending` with the applied id in one write, then send.
    const claimed = await this.commit(
      ctx,
      state.cycle.index,
      a.actionId,
      push({ ...message, status: "sending" }),
    );
    if (!claimed) return;
    if (overCap) return reportFromGoal(ctx, `Zpráva nenapsána (${a.actionId}): ${capped}`);
    const sent = await this.deliver(ctx.goal, { ...message, status: "sending" });
    if (sent.ok) {
      if (sent.replyRef) addWaits(ctx.instance, [{ kind: "reply", ref: sent.replyRef }]);
      // ponytail: replies inside the DM thread are not ingested (see docs/api/goals.md), so a
      // fallback wake keeps the goal from waiting forever.
      keepEarlierWake(ctx.instance, fallbackWake(ctx.now));
      ctx.timeline("message-sent", `Zpráva pro ${to} odeslána.`, refsOf(sent.replyRef));
      // Written now, not as a ctx effect: a dropped `apply` must not hide a message that went out.
      await this.report(ctx.goal, ctx.instanceKey, `zpráva pro ${to} odeslána`, "message");
    } else {
      reportFromGoal(ctx, `Zpráva pro ${to} se neodeslala: ${sent.error}`);
    }
  }

  /** The canonical recipient, or why there is none (closed: the planner cannot widen it). */
  private async resolve(
    a: MessageAction,
    ctx: GoalActionContext,
  ): Promise<{ target: Target; person: string; to: string } | { retry: string } | string> {
    const ref = a.to.ref.trim();
    if (a.to.kind === "slack-user") {
      if (!SLACK_USER_ID.test(ref)) return `${ref} není Slack user id (U…).`;
      let lookupFailed = false;
      for (const account of await this.slackAccounts(ctx.projectId)) {
        const creds = await this.credentials.read(account.id).catch(() => null);
        if (!creds) continue;
        const user = await this.adapters
          .slackOutbound()
          .userInfo(creds, ref)
          .catch((error: unknown) => {
            this.log?.warn("goal message: slack users.info failed", {
              integrationId: account.id,
              error: String(error),
            });
            lookupFailed = true;
            return null;
          });
        if (user) {
          const name = user.name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) || ref;
          return {
            target: { kind: "slack", integrationId: account.id, userId: ref },
            person: `slack:${ref}`,
            to: `${name} · Slack DM`,
          };
        }
      }
      // Not found anywhere, but a lookup errored (rate limit, network): not a verdict yet.
      if (lookupFailed) return { retry: `ověření ${ref} ve Slacku selhalo, zkusím znovu.` };
      return `${ref} není uživatel Slacku, ke kterému má tvůj účet přístup.`;
    }
    const about = a.about;
    if (!about) return "chybí PR.";
    const pr = (await this.prs.current()).find(
      (p) => p.repo.toLowerCase() === about.repo.toLowerCase() && p.number === about.number,
    );
    const prRef = `${about.repo}#${about.number}`;
    if (!pr) return `${prRef} není v PR inboxu.`;
    const inScope = ctx.projectId ? pr.projectId === ctx.projectId : pr.bucket === "mine";
    if (!inScope) return `${prRef} je mimo rozsah cíle.`;
    const reviewers = await this.prThreads.reviewers(pr.projectId, pr.number).catch(() => null);
    if (!reviewers) return `reviewery ${prRef} se nepodařilo načíst.`;
    const allowed = [
      pr.author,
      ...reviewers.users.map((u) => u.login),
      ...reviewers.teams.flatMap((t) => t.members.map((m) => m.login)),
    ].filter(Boolean);
    const wanted = ref.replace(/^@/, "").toLowerCase();
    const login = allowed.find((l) => l.toLowerCase() === wanted);
    if (!login) return `${ref} není autor ani reviewer ${prRef}.`;
    return {
      target: { kind: "pr", projectId: pr.projectId, repo: pr.repo, number: pr.number, login },
      person: `pr:${login.toLowerCase()}`,
      to: `@${login} · ${pr.repo}#${pr.number}`,
    };
  }

  /** Slack accounts serving the instance: its project's; a `_` instance: the operator's own. */
  private async slackAccounts(projectId: string | undefined): Promise<Integration[]> {
    const all = projectId
      ? await this.projects
          .get(projectId)
          .then((p) => this.resolvedProjects.resolveIntegrations(p))
          .catch(() => [])
      : (await this.integrations.list()).filter((i) => i.companyId === undefined);
    return all.filter((i) => i.kind === "slack" && i.enabled);
  }

  private async prUrl(target: Extract<Target, { kind: "pr" }>): Promise<string> {
    const pr = (await this.prs.current()).find(
      (p) => p.repo === target.repo && p.number === target.number,
    );
    return pr?.url ?? "";
  }

  /** One locked write: the record change + the applied id, only in the cycle it was planned in. */
  private async commit(
    ctx: GoalActionContext,
    cycle: number,
    actionId: string,
    fn: (s: GoalState) => void,
  ): Promise<boolean> {
    let ok = false;
    await this.store.update(ctx.goal.id, ctx.goal.createdAt, (s) => {
      const inst = s.instances[ctx.instanceKey];
      if (!inst || s.cycle.index !== cycle) return;
      if (!inst.appliedActionIds?.includes(actionId)) (inst.appliedActionIds ??= []).push(actionId);
      fn(s);
      ok = true;
    });
    if (ok && !ctx.applied(actionId)) (ctx.instance.appliedActionIds ??= []).push(actionId);
    return ok;
  }

  private markApplied(ctx: GoalActionContext, actionId: string): Promise<boolean> {
    return this.store
      .read(ctx.goal.id, ctx.goal.createdAt)
      .then((s) => this.commit(ctx, s.cycle.index, actionId, () => undefined));
  }

  /**
   * Send a message already claimed as `sending`, then record it `sent` (+ the nudge) or
   * `failed` in one write. A failed send never throws (the decision is already made); a
   * failing state write still does.
   */
  private async deliver(
    goal: Goal,
    message: GoalMessage,
  ): Promise<{ ok: true; replyRef?: string } | { ok: false; error: string }> {
    let result: { ok: true; replyRef?: string } | { ok: false; error: string };
    try {
      result = { ok: true, ...(await this.send(message)) };
    } catch (error) {
      result = { ok: false, error: errorText(error).slice(0, ERROR_MAX) };
    }
    const at = new Date().toISOString();
    await this.store.update(goal.id, goal.createdAt, (s) => {
      const m = s.messages?.find((x) => x.id === message.id);
      if (m) {
        if (result.ok) {
          m.status = "sent";
          m.sentAt = at;
          if (result.replyRef) m.replyRef = result.replyRef;
        } else {
          m.status = "failed";
          m.error = result.error;
        }
      }
      if (result.ok) {
        // Counted when actually sent, in whatever cycle it went out.
        const prev = s.nudges[message.person]?.count ?? 0;
        s.nudges[message.person] = { count: prev + 1, lastAt: at };
      }
    });
    return result;
  }

  /** The outbound call itself: a Slack DM, or a PR comment mentioning the person. */
  private async send(message: GoalMessage): Promise<{ replyRef?: string }> {
    const t = message.target;
    if (t.kind === "pr") {
      await this.prThreads.comment(t.projectId, t.repo, t.number, `@${t.login} ${message.text}`);
      return {};
    }
    const creds = await this.credentials.read(t.integrationId);
    if (!creds) throw new Error(`the Slack account ${t.integrationId} has no credentials`);
    const { channel, ts } = await this.adapters
      .slackOutbound()
      .postMessage(creds, t.userId, message.text);
    return { replyRef: `${t.integrationId}:${channel}:${ts}` };
  }

  // ---- the approval round-trip (ResumableRunner) ----

  /** Approve → send exactly once (the edited `messageText` when the operator gave one). */
  async resume(runId: string, approval?: Approval): Promise<void> {
    const found = await this.find(runId);
    if (!found) return;
    const { goal, messageId } = found;
    let claimed: GoalMessage | null = null;
    let blocked: string | null = null;
    let cycle = 0;
    await this.store.update(goal.id, goal.createdAt, (s) => {
      cycle = s.cycle.index;
      const m = s.messages?.find((x) => x.id === messageId);
      if (!m || m.status !== "pending") return;
      const edited = approval?.messageText?.trim();
      // The operator's edit goes through the same mention check as the planner's text.
      const mention = edited ? foreignMention(m.target, edited) : null;
      if (mention) {
        m.status = "failed";
        m.error = mention;
        blocked = `Upravená zpráva pro ${m.to} se neodeslala: ${mention}`;
        return;
      }
      m.status = "sending";
      if (edited) m.text = edited;
      claimed = { ...m };
    });
    const message = claimed as GoalMessage | null;
    const instance = messageId.split("/")[0] ?? "_";
    const refused = blocked as string | null;
    if (refused) {
      await this.note(goal, cycle, instance, refused, "report");
      return this.report(goal, instance, refused, "report");
    }
    if (!message) {
      // The operator approved, nothing went out: tell them (a new cycle dropped the draft, or
      // it was already sent).
      const text = `Schválená zpráva ${messageId} se neodeslala: koncept už neplatí.`;
      await this.note(goal, cycle, instance, text, "report");
      return this.report(goal, instance, text, "report");
    }
    const sent = await this.deliver(goal, message);
    if (sent.ok) {
      // As on the auto path: wait on the reply, and look again on a later working morning.
      await this.store.update(goal.id, goal.createdAt, (s) => {
        const inst = s.instances[instance];
        if (!inst || s.cycle.index !== cycle || inst.status === "parked") return;
        if (inst.status === "done") return;
        if (sent.replyRef) addWaits(inst, [{ kind: "reply", ref: sent.replyRef }]);
        keepEarlierWake(inst, fallbackWake(new Date()));
        inst.status = "waiting";
      });
    }
    const text = sent.ok
      ? `Zpráva pro ${message.to} odeslána (schváleno).`
      : `Zpráva pro ${message.to} se neodeslala: ${sent.error}`;
    await this.note(goal, cycle, instance, text, sent.ok ? "message-sent" : "report");
    await this.report(goal, instance, text, sent.ok ? "message" : "report");
  }

  /** A new cycle dropped these drafts: their pending approvals are rejected, not left dangling. */
  async rejectStale(approvalIds: string[]): Promise<void> {
    for (const id of approvalIds) {
      await this.approvals.reject(id, "nový cyklus cíle").catch((error: unknown) =>
        this.log?.warn("goal message: stale approval reject failed", {
          id,
          error: String(error),
        }),
      );
    }
  }

  private report(goal: Goal, instance: string, text: string, action: string): Promise<void> {
    return this.activity.record({
      kind: "goal-acted",
      summary: `${goal.name}: ${text}`.slice(0, 300),
      refs: {
        goalId: goal.id,
        itemId: instance,
        ...(instance !== "_" ? { projectId: instance } : {}),
        action,
      },
    });
  }

  /** Reject → the draft is dropped (`rejected`, a fact the planner sees). */
  async cancel(runId: string): Promise<void> {
    const found = await this.find(runId);
    if (!found) return;
    const { goal, messageId } = found;
    let to: string | null = null;
    let cycle = 0;
    await this.store.update(goal.id, goal.createdAt, (s) => {
      cycle = s.cycle.index;
      const m = s.messages?.find((x) => x.id === messageId);
      if (!m || m.status !== "pending") return;
      m.status = "rejected";
      to = m.to;
    });
    if (to) {
      await this.note(goal, cycle, messageId.split("/")[0] ?? "_", `Zpráva pro ${to} zamítnuta.`);
    }
  }

  private async find(runId: string): Promise<{ goal: Goal; messageId: string } | null> {
    const slash = runId.indexOf("/");
    const goal = await this.goals.get(runId.slice(0, slash)).catch(() => null);
    if (slash < 0 || !goal) {
      this.log?.warn("goal message: approval for an unknown goal", { runId });
      return null;
    }
    return { goal, messageId: runId.slice(slash + 1) };
  }

  private note(goal: Goal, cycle: number, instance: string, text: string, kind = "note") {
    return this.store.appendTimeline(goal.id, {
      at: new Date().toISOString(),
      cycle,
      instance,
      kind,
      text,
    });
  }

  // ---- facts source `messages` ----

  /**
   * This instance's messages this cycle (no goal-wide counters: those reach the planner through
   * its context, and fingerprinting them would wake every instance on each send).
   */
  async collect({ goal, instanceKey }: GoalFactsContext): Promise<unknown> {
    const state = await this.store.read(goal.id, goal.createdAt);
    const mine = (state.messages ?? []).filter((m) => m.instance === instanceKey);
    if (!mine.length) return undefined;
    return mine
      .map((m) => ({
        actionId: m.actionId,
        to: m.to,
        person: m.person,
        status: m.status,
        ...(m.replyRef ? { replyRef: m.replyRef } : {}),
      }))
      .sort((x, y) => x.actionId.localeCompare(y.actionId));
  }
}

/** Sent + still-pending/sending messages to `person` this cycle. */
function used(state: GoalState, person: string): number {
  const open = (state.messages ?? []).filter(
    (m) => m.person === person && (m.status === "pending" || m.status === "sending"),
  ).length;
  return (state.nudges[person]?.count ?? 0) + open;
}

/**
 * Auto may send without approval only to someone the goal already knows: a PR author/reviewer
 * (resolve() enforces it), or a Slack id named in the goal definition or in this instance's own
 * facts (its ingested channel items, PR participants). Membership of the workspace is not enough.
 * The `messages` facts are excluded: a rejected draft must not make its recipient "known".
 */
function knownRecipient(ctx: GoalActionContext, target: Target): boolean {
  if (target.kind === "pr") return true;
  const id = new RegExp(`(?<![A-Z0-9])${target.userId}(?![A-Z0-9])`);
  const facts = Object.entries(ctx.facts).filter(([source]) => source !== "messages");
  return id.test(JSON.stringify(ctx.goal)) || id.test(JSON.stringify(facts));
}

const PRAGUE = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** A mention of anyone but the resolved person (or a Slack mass mention) is refused. */
function foreignMention(target: Target, text: string): string | null {
  if (target.kind === "slack") {
    return /<[@!]/.test(text) ? "text zmiňuje další lidi nebo kanál." : null;
  }
  for (const [, login] of text.matchAll(MENTION)) {
    if (login && login.toLowerCase() !== target.login.toLowerCase()) {
      return `text zmiňuje @${login}, který není příjemce.`;
    }
  }
  return null;
}

/** The approval's JSON detail (the sheet's message preview: recipient, channel/PR, full text). */
function approvalDetail(label: string, m: GoalMessage): string {
  return JSON.stringify({
    summary: `Zpráva pro ${m.to}`,
    riskType: "odeslani",
    consequence: `Cíl ${label} pošle tuto zprávu tvým jménem (${m.to}).`,
    preview: { kind: "message", to: m.to, body: m.text },
  });
}

/** The next working morning at least half a day away: the goal looks again then. */
function fallbackWake(now: Date): string {
  return nextWorkingStart(new Date(now.getTime() + 12 * 60 * 60 * 1000)).toISOString();
}

function refsOf(replyRef: string | undefined): Record<string, string> | undefined {
  return replyRef ? { replyRef } : undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
