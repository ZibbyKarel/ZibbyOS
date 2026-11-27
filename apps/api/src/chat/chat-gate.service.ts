import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { Injectable, type OnModuleInit, Optional } from "@nestjs/common";
import type { Approval, ChatGateCheckBody, ChatGateDecision } from "@zibby/contracts";
import { ApprovalAlreadyDecidedError, ApprovalNotFoundError } from "../approvals/approvals.errors";
import { ApprovalsService } from "../approvals/approvals.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { GateEvaluatorService } from "../gates/gate-evaluator.service";
import { intentApprovalDetail } from "../gates/intent-approval-detail";
import { dataDir } from "../shared/data-dir";
import { isPrimaryInstance } from "../shared/instance-role";
import { CHAT_NEVER_ACTIONS } from "./chat-opencode";
import { ChatToolResultRegistry } from "./chat-tool-result.registry";

/** How long a held chat call waits for the operator before the server refuses it (Q8). */
export const CHAT_APPROVAL_WAIT_MS = 300_000;
/** A raw command longer than this is denied as too large to review in a card (R10). */
export const CHAT_GATE_MAX_COMMAND_CHARS = 20_000;

const deny = (reason: string): ChatGateDecision => ({ decision: "deny", reason });

/** The hash the plugin sends: `sha256(tool + "\0" + JSON.stringify(input))`. */
export function chatGateHash(tool: string, input: unknown): string {
  return createHash("sha256")
    .update(tool + "\0" + JSON.stringify(input))
    .digest("hex");
}

/** The full text the call will run: the shell command, else the JSON input. */
function rawCommand(tool: string, input: unknown): string {
  const command = (input as { command?: unknown } | null | undefined)?.command;
  if ((tool === "shell" || tool === "bash") && typeof command === "string") return command;
  return JSON.stringify(input) ?? "";
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
  return [...dirs];
}

/**
 * Decides a classified chat tool call for the opencode chat plugin (the plugin only classifies;
 * this is the single source of truth). A call is allowed silently only by an explicit allow rule;
 * everything else that is not denied becomes a `kind:"chat"` approval plus an inline card, and the
 * plugin holds the call until the operator decides. Nothing here is cached: an approval releases
 * the one held call that requested it.
 */
@Injectable()
export class ChatGateService implements OnModuleInit {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly gates: GateEvaluatorService,
    private readonly toolResults: ChatToolResultRegistry,
    @Optional() private readonly autopilot?: AutopilotService,
  ) {}

  /** Rejects stale pending chat approvals a previous process left behind (primary only, R9). */
  async onModuleInit(): Promise<void> {
    if (!isPrimaryInstance()) return;
    try {
      const pending = await this.pendingChat();
      await Promise.all(
        pending
          .filter((a) => this.expired(a))
          .map((a) => this.rejectQuietly(a.id, "Expired: no decision in time.")),
      );
    } catch {
      // best-effort sweep; status() expiry covers whatever it misses
    }
  }

  async check(conversationId: string, body: ChatGateCheckBody): Promise<ChatGateDecision> {
    const { tool, input, intents } = body;
    if (chatGateHash(tool, input) !== body.hash) return deny("The call does not match its hash.");
    const cmd = rawCommand(tool, input);
    if (intents.some((i) => i.action === "unclassified"))
      return deny("The ZIBBY gate could not classify this call.");
    if (cmd.length > CHAT_GATE_MAX_COMMAND_CHARS) {
      return deny("Too large to review in the chat; split it into smaller steps.");
    }
    if (this.autopilot?.isPaused()) return deny("ZIBBY is paused.");
    if (protectedDirs().some((d) => cmd.includes(d))) {
      return deny(
        "Touches the ZIBBY data directory (gate rules and approvals), which the chat may not change.",
      );
    }

    const floor = await this.gates.floor();
    const evals = intents.map((intent) => ({ intent, ev: this.gates.evaluate(floor, intent) }));
    const denied = evals.find((e) => e.ev.decision === "deny");
    if (denied) return deny(`The ZIBBY gate denies "${denied.intent.action}".`);
    const mentions = this.toolResults.getMentions(conversationId);
    const agentTurn = mentions.length === 1 && mentions[0]?.kind === "agent";
    if (
      !agentTurn &&
      evals.every(
        (e) => e.ev.decision === "allow" && e.ev.ruleId && !CHAT_NEVER_ACTIONS.has(e.intent.action),
      )
    ) {
      return { decision: "allow" };
    }

    // The card is labelled by the highest-risk action (delete first); the summary lists all of them.
    const primary = intents.find((i) => i.action === "delete") ?? intents[0];
    if (!primary) return deny("The ZIBBY gate could not classify this call.");
    const actions = [...new Set(intents.map((i) => i.action))];
    const approval = await this.approvals.requestApproval({
      runId: `${conversationId}/${body.hash.slice(0, 16)}`,
      kind: "chat",
      skill: "ZIBBY chat",
      action: primary.action,
      detail: this.detail(body, primary, actions, cmd),
      risk: primary.action === "delete" ? "high" : "medium",
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
    if (approval.status === "pending" && this.expired(approval)) {
      approval =
        (await this.rejectQuietly(approvalId, "Expired: no decision in time.")) ?? approval;
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

  private expired(a: Approval): boolean {
    return Date.now() - Date.parse(a.requestedAt) > CHAT_APPROVAL_WAIT_MS;
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
