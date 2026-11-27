import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Injectable, type OnModuleDestroy, type OnModuleInit, Optional } from "@nestjs/common";
import type { Approval, ChatGateCheckBody, ChatGateDecision, GateRule } from "@zibby/contracts";
import { ApprovalAlreadyDecidedError, ApprovalNotFoundError } from "../approvals/approvals.errors";
import {
  ApprovalsService,
  CHAT_APPROVAL_EXPIRED_REASON,
  CHAT_APPROVAL_WAIT_MS,
  chatApprovalExpired,
} from "../approvals/approvals.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { GateEvaluatorService, actionInClass } from "../gates/gate-evaluator.service";
import { intentApprovalDetail } from "../gates/intent-approval-detail";
import { dataDir } from "../shared/data-dir";
import { isPrimaryInstance } from "../shared/instance-role";
import { CHAT_NEVER_ACTIONS } from "./chat-opencode";
import { ChatToolResultRegistry } from "./chat-tool-result.registry";

export { CHAT_APPROVAL_WAIT_MS };
/** How often the primary instance rejects expired chat approvals nobody polls any more. */
export const CHAT_APPROVAL_SWEEP_MS = 60_000;
/** A raw command longer than this is denied as too large to review in a card (R10). */
export const CHAT_GATE_MAX_COMMAND_CHARS = 20_000;

const deny = (reason: string): ChatGateDecision => ({ decision: "deny", reason });

/** The hash the plugin sends: `sha256(tool + "\0" + JSON.stringify(input))`. */
export function chatGateHash(tool: string, input: unknown): string {
  return createHash("sha256")
    .update(tool + "\0" + JSON.stringify(input))
    .digest("hex");
}

/**
 * Mirror of the run hook's `ACTION_RANK` (`claude-approval-hook.mjs`, parity-tested): which of a
 * chain's actions labels the card. An action missing here ranks above every listed one.
 */
export const CHAT_ACTION_RANK: Readonly<Record<string, number>> = {
  delete: 0,
  overwrite: 0,
  move: 0,
  "git.push": 1,
  "jira.create_issue": 1,
  "pr.open": 2,
  "gh.pr_comment": 3,
  "gh.api_write": 4,
  "git.force_push": 5,
  deploy: 6,
  "pr.merge": 7,
};
/** Actions that make the card high risk (hold to approve), whatever else the chain does. */
const HIGH_RISK_ACTIONS = new Set([
  "delete",
  "overwrite",
  "move",
  "git.force_push",
  "deploy",
  "pr.merge",
  "shell.opaque",
]);
const severity = (action: string): number =>
  (HIGH_RISK_ACTIONS.has(action) ? 100 : 0) + (CHAT_ACTION_RANK[action] ?? 50);

const isShell = (tool: string) => tool === "shell" || tool === "bash";

/** The shell call's own `workdir` / `directory`, or undefined. */
function workdirOf(tool: string, input: unknown): string | undefined {
  if (!isShell(tool) || !input || typeof input !== "object") return undefined;
  const i = input as { workdir?: unknown; directory?: unknown };
  return [i.workdir, i.directory].find((d): d is string => typeof d === "string" && d !== "");
}

const shellQuote = (s: string) =>
  /^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * The full text the call will run: the shell command — prefixed with `cd <workdir> &&` when the
 * call sets one (the plugin's resolved `cwd`, else the raw `workdir`) — else the JSON input.
 */
function rawCommand(body: ChatGateCheckBody): string {
  const { tool, input } = body;
  const command = (input as { command?: unknown } | null | undefined)?.command;
  if (!isShell(tool) || typeof command !== "string") return JSON.stringify(input) ?? "";
  const workdir = workdirOf(tool, input);
  if (!workdir) return command;
  return `cd ${shellQuote(body.cwd ?? expandHome(workdir))} && ${command}`;
}

/** `~` / `$HOME` / `${HOME}` at the start of a path, expanded. */
function expandHome(p: string): string {
  const home = os.homedir();
  return p.replace(/^~(?=\/|$)/, home).replace(/^\$\{HOME\}|^\$HOME(?![A-Za-z0-9_])/, home);
}

/**
 * Text normalised for the protected-dir match: escapes and quotes dropped (so
 * `Application\ Support` and `"…/Application Support/…"` read the same), `~` / `$HOME` /
 * `${HOME}` expanded, lower-cased (APFS is case-insensitive). Dropping every backslash also
 * reads a JSON-escaped string as written. A match only ever denies, so over-matching is safe.
 */
export function normalizePathText(text: string): string {
  const home = os.homedir();
  return text
    .replace(/[\\"']/g, "")
    .replace(/\$\{HOME\}|\$HOME(?![A-Za-z0-9_])/g, home)
    .replace(/(^|[\s=:([,{;&|<>])~(?=\/|$|[\s,}\];&|])/g, `$1${home}`)
    .toLowerCase();
}

/**
 * The old chat guarantee (pre-inline-approvals `chatAllowedActions`), kept as an extra condition
 * of a SILENT allow: every global rule that can match `action` by its action class — branch- or
 * scope-qualified ones included — is `allow`, and no non-`allow` catch-all (a `tool` / `context`
 * rule with no action) exists. So a branchless `git push` never runs silently while any push
 * rule (e.g. `gr-push-main`) asks; it gets a card instead.
 */
export function everyMatchingRuleAllows(floor: readonly GateRule[], action: string): boolean {
  for (const rule of floor) {
    const keyed = rule.match.some((c) => c.type === "action");
    const catchAll = rule.match.some((c) => c.type === "tool" || c.type === "context");
    if (rule.decision !== "allow" && !keyed && catchAll) return false;
  }
  return floor
    .filter((r) => r.match.some((c) => c.type === "action" && actionInClass(action, c.action)))
    .every((r) => r.decision === "allow");
}

/** The intent of an ungated shell call (the plugin's `CHAT_PATH_CHECK`): protected-dir checks only. */
export const CHAT_PATH_CHECK = "shell.path_check";

/** The `cd` / `pushd` targets of a shell command, in order (the plugin's `cdTargets`). */
function cdTargets(command: string): string[] {
  return [
    ...command.matchAll(/(?:^|[;&|(\s])(?:cd|pushd)\s+("[^"]*"|'[^']*'|(?:\\.|[^\s;&|)])+)/g),
  ].map((m) => m[1] ?? "");
}

/**
 * Whether a `cd` / `pushd` of the shell call lands in a protected dir, or in an ancestor of one
 * while the command names the rest of the way (`cd ~/Library && touch "Application Support/…"`).
 * Targets resolve in sequence from the plugin's `cwd`; a relative one with no base is skipped.
 */
function cdIntoProtected(body: ChatGateCheckBody, dirs: string[], haystack: string): boolean {
  const command = (body.input as { command?: unknown } | null | undefined)?.command;
  if (!isShell(body.tool) || typeof command !== "string") return false;
  let base = body.cwd;
  for (const target of cdTargets(command)) {
    const t = expandHome(target.replace(/[\\"']/g, ""));
    if (!path.isAbsolute(t) && !base) continue;
    base = path.resolve(base ?? "/", t);
    const at = normalizePathText(base);
    const hit = (d: string) =>
      at === d ||
      at.startsWith(d + "/") ||
      (d.startsWith(at + "/") && haystack.includes(d.slice(at.length + 1)));
    if (dirs.some(hit)) return true;
  }
  return false;
}

/**
 * A deny rule scoped to a concrete branch matches this action class while the intent names no
 * concrete branch (a bare `git push`, `HEAD`): the gate cannot tell whether the rule applies.
 */
function denyNeedsBranch(
  floor: readonly GateRule[],
  intent: ChatGateCheckBody["intents"][number],
): boolean {
  const named = [intent.branch, ...(intent.branches ?? [])].filter((b) => b && b !== "HEAD");
  if (named.length) return false;
  return floor.some(
    (r) =>
      r.decision === "deny" &&
      r.match.some(
        (c) =>
          c.type === "action" &&
          c.branch !== undefined &&
          c.branch !== "*" &&
          actionInClass(intent.action, c.action),
      ),
  );
}

/** The ZibbyOS data dir and the dirs holding the gate rules / policy / approvals. */
function protectedDirs(): string[] {
  const dirs = new Set<string>();
  for (const d of [
    dataDir(),
    process.env.GATE_RULES_DIR,
    process.env.POLICY_DIR,
    process.env.APPROVALS_DIR,
  ]) {
    if (!d) continue;
    dirs.add(d);
    try {
      dirs.add(realpathSync(d));
    } catch {
      // not on disk (yet): the literal path is all there is to match
    }
  }
  return [...dirs].map(normalizePathText);
}

/**
 * Decides a classified chat tool call for the opencode chat plugin (the plugin only classifies;
 * this is the single source of truth). A call is allowed silently only by an explicit allow rule;
 * everything else that is not denied becomes a `kind:"chat"` approval plus an inline card, and the
 * plugin holds the call until the operator decides. Nothing here is cached: an approval releases
 * the one held call that requested it.
 */
@Injectable()
export class ChatGateService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly approvals: ApprovalsService,
    private readonly gates: GateEvaluatorService,
    private readonly toolResults: ChatToolResultRegistry,
    @Optional() private readonly autopilot?: AutopilotService,
  ) {}

  /**
   * Rejects expired pending chat approvals (primary only, R9): once at boot (a previous process
   * left them behind) and then every {@link CHAT_APPROVAL_SWEEP_MS}, so a card nothing polls any
   * more (the plugin gave up, the API restarted) expires on its own. A late approve is refused
   * by `ApprovalsService.approve` as well.
   */
  async onModuleInit(): Promise<void> {
    if (!isPrimaryInstance()) return;
    await this.sweep();
    this.sweepTimer = setInterval(() => void this.sweep(), CHAT_APPROVAL_SWEEP_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = undefined;
  }

  /** Reject every expired pending chat approval (best effort, never throws). */
  async sweep(): Promise<void> {
    try {
      const pending = await this.pendingChat();
      await Promise.all(
        pending
          .filter((a) => chatApprovalExpired(a))
          .map((a) => this.rejectQuietly(a.id, CHAT_APPROVAL_EXPIRED_REASON)),
      );
    } catch {
      // best-effort; status() and approve() refuse an expired card regardless
    }
  }

  async check(conversationId: string, body: ChatGateCheckBody): Promise<ChatGateDecision> {
    const { tool, input, intents } = body;
    // Only a conversation with a turn in flight can hold a call: a forged or stale check gets
    // no approval record, no card and no Slack ping.
    if (!this.toolResults.hasTurn(conversationId)) {
      return deny("No chat turn is in flight to ask the operator in.");
    }
    if (chatGateHash(tool, input) !== body.hash) return deny("The call does not match its hash.");
    const cmd = rawCommand(body);
    if (intents.some((i) => i.action === "unclassified"))
      return deny("The ZIBBY gate could not classify this call.");
    // `shell.path_check` marks an ungated shell call: only the protected-dir checks below apply.
    const gated = intents.filter((i) => i.action !== CHAT_PATH_CHECK);
    if (gated.length && cmd.length > CHAT_GATE_MAX_COMMAND_CHARS) {
      return deny("Too large to review in the chat; split it into smaller steps.");
    }
    if (gated.length && this.autopilot?.isPaused()) return deny("ZIBBY is paused.");
    const workdirText = workdirOf(tool, input) ? (body.cwd ?? "") : "";
    const haystack = normalizePathText(`${cmd}\n${JSON.stringify(input) ?? ""}\n${workdirText}`);
    const dirs = protectedDirs();
    if (dirs.some((d) => haystack.includes(d)) || cdIntoProtected(body, dirs, haystack)) {
      return deny(
        "Touches the ZIBBY data directory (gate rules and approvals), which the chat may not change.",
      );
    }
    if (!gated.length) return { decision: "allow" };

    const floor = await this.gates.floor();
    const evals = gated.map((intent) => ({ intent, ev: this.gates.evaluate(floor, intent) }));
    const denied = evals.find((e) => e.ev.decision === "deny");
    if (denied) return deny(`The ZIBBY gate denies "${denied.intent.action}".`);
    const branchless = evals.find((e) => denyNeedsBranch(floor, e.intent));
    if (branchless) return deny("Name the target branch explicitly (git push origin <branch>).");
    const mentions = this.toolResults.getMentions(conversationId);
    const agentTurn = mentions.length === 1 && mentions[0]?.kind === "agent";
    if (
      !agentTurn &&
      evals.every(
        (e) =>
          e.ev.decision === "allow" &&
          e.ev.ruleId &&
          !CHAT_NEVER_ACTIONS.has(e.intent.action) &&
          everyMatchingRuleAllows(floor, e.intent.action),
      )
    ) {
      return { decision: "allow" };
    }

    // The card is labelled by the most severe action; the summary lists all of them, and any
    // high-risk action in the chain makes the whole card high risk (hold to approve).
    const primary = gated.reduce<(typeof gated)[number] | undefined>(
      (best, i) => (!best || severity(i.action) > severity(best.action) ? i : best),
      undefined,
    );
    if (!primary) return deny("The ZIBBY gate could not classify this call.");
    const actions = [...new Set(gated.map((i) => i.action))];
    const approval = await this.approvals.requestApproval({
      runId: `${conversationId}/${body.hash.slice(0, 16)}`,
      kind: "chat",
      skill: "ZIBBY chat",
      action: primary.action,
      detail: this.detail(body, primary, actions, cmd),
      risk: gated.some((i) => HIGH_RISK_ACTIONS.has(i.action)) ? "high" : "medium",
    });
    if (
      !this.toolResults.pushWidget(conversationId, { kind: "approval", approvalId: approval.id })
    ) {
      await this.rejectQuietly(approval.id, "No chat turn in flight.");
      return deny("No chat turn is in flight to ask the operator in.");
    }
    return { decision: "pending", approvalId: approval.id };
  }

  /** The decision of a held call; a pending one past the wait deadline is refused first. */
  async status(
    conversationId: string,
    approvalId: string,
  ): Promise<{ status: Approval["status"] }> {
    let approval = await this.approvals.get(approvalId);
    if (approval.kind !== "chat" || !approval.runId.startsWith(`${conversationId}/`)) {
      throw new ApprovalNotFoundError(approvalId);
    }
    if (chatApprovalExpired(approval)) {
      approval = (await this.rejectQuietly(approvalId, CHAT_APPROVAL_EXPIRED_REASON)) ?? approval;
    }
    return { status: approval.status };
  }

  /** The turn ended (any path): refuse this conversation's still-pending chat approvals. */
  async settleTurn(conversationId: string): Promise<void> {
    const mine = (await this.pendingChat()).filter((a) => a.runId.startsWith(`${conversationId}/`));
    await Promise.all(
      mine.map((a) => this.rejectQuietly(a.id, "Chat turn ended before a decision.")),
    );
  }

  private async pendingChat(): Promise<Approval[]> {
    return (await this.approvals.list("pending")).filter((a) => a.kind === "chat");
  }

  /** Reject, tolerating a concurrent decision (returns the record, or undefined if it raced). */
  private async rejectQuietly(id: string, reason: string): Promise<Approval | undefined> {
    try {
      return await this.approvals.reject(id, reason);
    } catch (error) {
      if (error instanceof ApprovalAlreadyDecidedError) return this.approvals.get(id);
      throw error;
    }
  }

  /** The enrichment JSON the card reads, with `preview.cmd` overwritten by the full raw command. */
  private detail(
    body: ChatGateCheckBody,
    intent: ChatGateCheckBody["intents"][number],
    actions: string[],
    cmd: string,
  ): string {
    const { tool, input } = body;
    const mcp = intent.action.startsWith("mcp.");
    const full = mcp
      ? `${[intent.scope, intent.tool ?? tool].filter(Boolean).join(" · ")} ${JSON.stringify(input, null, 2)}`
      : cmd;
    let base: Record<string, unknown> | undefined;
    try {
      const parsed: unknown = JSON.parse(intent.context ?? "");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      // context is plain text: build the enrichment below
    }
    const preview = { kind: "command", cmd: full };
    const summary = actions.length > 1 ? `Actions: ${actions.join(", ")}` : undefined;
    return JSON.stringify(
      base
        ? {
            ...base,
            ...(summary ? { summary } : {}),
            preview: { ...(base.preview as object | undefined), ...preview },
          }
        : { summary: summary ?? intentApprovalDetail(intent), preview },
    );
  }
}
