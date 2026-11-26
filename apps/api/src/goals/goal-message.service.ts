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
 *   instance's place and Autopilot is not paused; otherwise a `goal-message` approval. The
 *   goal's ceiling (tier2, checked by the executor) is necessary, never sufficient.
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
    const { target, person, to } = resolved;
    const mentionError = foreignMention(target, text);
    if (mentionError) return notDone(mentionError);

    if (!isWorkingHours(ctx.now)) {
      const at = nextWorkingStart(ctx.now).toISOString();
      keepEarlierWake(ctx.instance, at);
      ctx.timeline("note", `Zpráva pro ${to} odložena na ${at} (mimo pracovní dobu).`);
      return;
    }

    const state = await this.store.read(ctx.goal.id, ctx.goal.createdAt);
    if (used(state, person) >= MESSAGES_PER_PERSON) {
      return notDone(
        `${to} už v tomto cyklu dostal(a) ${MESSAGES_PER_PERSON} zprávy — další je na tobě.`,
      );
    }

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
    if (level !== "auto") {
      const approval = await this.approvals.requestApproval({
        runId: `${ctx.goal.id}/${message.id}`,
        kind: "goal-message",
        skill: "goal",
        action: "message.send",
        detail: approvalDetail(ctx.label, message),
        risk: "medium",
        ...(target.kind === "pr" ? { sourceUrl: await this.prUrl(target) } : {}),
      });
      const stored = await this.commit(ctx, state.cycle.index, a.actionId, (s) => {
        (s.messages ??= []).push({ ...message, approvalId: approval.id });
      });
      if (!stored) return;
      addWaits(ctx.instance, [{ kind: "approval", ref: approval.id }]);
      ctx.timeline("message-drafted", `Zpráva pro ${to} čeká na schválení.`, {
        approvalId: approval.id,
      });
      return;
    }

    // Auto: claim it as `sending` with the applied id in one write, then send.
    const claimed = await this.commit(ctx, state.cycle.index, a.actionId, (s) => {
      (s.messages ??= []).push({ ...message, status: "sending" });
    });
    if (!claimed) return;
    const sent = await this.deliver(ctx.goal, { ...message, status: "sending" });
    if (sent.ok) {
      if (sent.replyRef) addWaits(ctx.instance, [{ kind: "reply", ref: sent.replyRef }]);
      // ponytail: replies inside the DM thread are not ingested (see docs/api/goals.md), so a
      // fallback wake keeps the goal from waiting forever.
      keepEarlierWake(ctx.instance, fallbackWake(ctx.now));
      ctx.timeline("message-sent", `Zpráva pro ${to} odeslána.`, refsOf(sent.replyRef));
      ctx.activity("goal-acted", `${ctx.label}: zpráva pro ${to} odeslána`, {
        action: "message",
      });
    } else {
      reportFromGoal(ctx, `Zpráva pro ${to} se neodeslala: ${sent.error}`);
    }
  }

  /** The canonical recipient, or why there is none (closed: the planner cannot widen it). */
  private async resolve(
    a: MessageAction,
    ctx: GoalActionContext,
  ): Promise<{ target: Target; person: string; to: string } | string> {
    const ref = a.to.ref.trim();
    if (a.to.kind === "slack-user") {
      if (!SLACK_USER_ID.test(ref)) return `${ref} není Slack user id (U…).`;
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
            return null;
          });
        if (user) {
          return {
            target: { kind: "slack", integrationId: account.id, userId: ref },
            person: `slack:${ref}`,
            to: `${user.name} · Slack DM`,
          };
        }
      }
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
   * `failed` in one write. Never throws: the decision is already made.
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
    let cycle = 0;
    await this.store.update(goal.id, goal.createdAt, (s) => {
      cycle = s.cycle.index;
      const m = s.messages?.find((x) => x.id === messageId);
      if (!m || m.status !== "pending") return;
      m.status = "sending";
      const edited = approval?.messageText?.trim();
      if (edited) m.text = edited;
      claimed = { ...m };
    });
    const message = claimed as GoalMessage | null;
    const instance = messageId.split("/")[0] ?? "_";
    if (!message) {
      return this.note(goal, cycle, instance, `Schválená zpráva ${messageId} už není k odeslání.`);
    }
    const sent = await this.deliver(goal, message);
    const text = sent.ok
      ? `Zpráva pro ${message.to} odeslána (schváleno).`
      : `Zpráva pro ${message.to} se neodeslala: ${sent.error}`;
    await this.note(goal, cycle, instance, text, sent.ok ? "message-sent" : "report");
    await this.activity.record({
      kind: "goal-acted",
      summary: `${goal.name}: ${text}`.slice(0, 300),
      refs: {
        goalId: goal.id,
        itemId: instance,
        ...(instance !== "_" ? { projectId: instance } : {}),
        action: sent.ok ? "message" : "report",
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
