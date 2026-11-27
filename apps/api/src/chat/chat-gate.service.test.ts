import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ChatGateCheckBody,
  ChatWidget,
  GateEvaluation,
  IntendedAction,
} from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalAlreadyDecidedError, ApprovalNotFoundError } from "../approvals/approvals.errors";
import { ApprovalsService } from "../approvals/approvals.service";
import { ApprovalsStorageService } from "../approvals/approvals.storage.service";
import type { AutopilotService } from "../autopilot/autopilot.service";
import type { GateEvaluatorService } from "../gates/gate-evaluator.service";
import { dataDir } from "../shared/data-dir";
import { CHAT_APPROVAL_WAIT_MS, ChatGateService, chatGateHash } from "./chat-gate.service";
import type { ChatToolResultRegistry } from "./chat-tool-result.registry";

const CONV = "conv_1";

describe("ChatGateService", () => {
  let dir: string;
  let approvals: ApprovalsService;
  let evaluation: GateEvaluation;
  let byAction: Record<string, GateEvaluation>;
  let paused: boolean;
  let turnInFlight: boolean;
  let mentions: { kind: string }[];
  let widgets: ChatWidget[];
  let service: ChatGateService;

  const body = (
    over: Partial<{
      tool: string;
      input: unknown;
      intent: IntendedAction;
      intents: IntendedAction[];
    }> = {},
  ): ChatGateCheckBody => {
    const tool = over.tool ?? "shell";
    const input = "input" in over ? over.input : { command: "echo hi > /tmp/x" };
    return {
      tool,
      input,
      hash: chatGateHash(tool, input),
      intents: over.intents ?? [over.intent ?? { action: "overwrite" }],
    };
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-gate-"));
    approvals = new ApprovalsService(new ApprovalsStorageService(dir));
    evaluation = { decision: "ask", ruleId: "r1" };
    byAction = {};
    paused = false;
    turnInFlight = true;
    mentions = [];
    widgets = [];
    const gates = {
      floor: vi.fn(async () => []),
      evaluate: vi.fn((_f: unknown, i: IntendedAction) => byAction[i.action] ?? evaluation),
    } as unknown as GateEvaluatorService;
    const registry = {
      pushWidget: vi.fn((_c: string, w: ChatWidget) => {
        if (turnInFlight) widgets.push(w);
        return turnInFlight;
      }),
      getMentions: vi.fn(() => mentions),
    } as unknown as ChatToolResultRegistry;
    const autopilot = { isPaused: () => paused } as unknown as AutopilotService;
    service = new ChatGateService(approvals, gates, registry, autopilot);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const pending = () => approvals.list("pending");

  it("denies a deny-tier action and creates no approval", async () => {
    evaluation = { decision: "deny", ruleId: "r" };
    const r = await service.check(CONV, body({ intent: { action: "git.merge" } }));
    expect(r.decision).toBe("deny");
    expect(await approvals.list()).toHaveLength(0);
    expect(widgets).toHaveLength(0);
  });

  it("allows silently on an explicit allow rule", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    const r = await service.check(CONV, body({ intent: { action: "git.push" } }));
    expect(r).toEqual({ decision: "allow" });
    expect(await approvals.list()).toHaveLength(0);
  });

  it("asks on a default allow (no ruleId)", async () => {
    evaluation = { decision: "allow" };
    const r = await service.check(CONV, body({ intent: { action: "git.push" } }));
    expect(r.decision).toBe("pending");
  });

  it("asks on notify", async () => {
    evaluation = { decision: "notify", ruleId: "r" };
    expect((await service.check(CONV, body())).decision).toBe("pending");
  });

  it("asks (never silent) on an allowed overwrite", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    expect((await service.check(CONV, body({ intent: { action: "overwrite" } }))).decision).toBe(
      "pending",
    );
  });

  it("asks on an allowed action in an @agent turn", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    mentions = [{ kind: "agent" }];
    expect((await service.check(CONV, body({ intent: { action: "git.push" } }))).decision).toBe(
      "pending",
    );
  });

  it("denies a chain containing a denied action even when the first intent is allowed", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    byAction = { "git.merge": { decision: "deny", ruleId: "d" } };
    const r = await service.check(
      CONV,
      body({ intents: [{ action: "git.push" }, { action: "git.merge" }] }),
    );
    expect(r).toMatchObject({ decision: "deny", reason: expect.stringContaining("git.merge") });
    expect(await approvals.list()).toHaveLength(0);
  });

  it("no silent allow unless EVERY intent has an allow rule", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    byAction = { "git.push": { decision: "allow" } }; // default allow: no ruleId
    const r = await service.check(
      CONV,
      body({ intents: [{ action: "gh.api_write" }, { action: "git.push" }] }),
    );
    expect(r.decision).toBe("pending");
    const [a] = await pending();
    expect(JSON.parse(a?.detail ?? "{}").summary).toMatch(/gh\.api_write, git\.push/);
    // all allowed with rules -> silent
    byAction = {};
    const ok = await service.check(
      CONV,
      body({ intents: [{ action: "gh.api_write" }, { action: "git.push" }] }),
    );
    expect(ok).toEqual({ decision: "allow" });
  });

  it("denies when any intent is unclassified; labels the card by delete when present", async () => {
    const r = await service.check(
      CONV,
      body({ intents: [{ action: "git.push" }, { action: "unclassified" }] }),
    );
    expect(r.decision).toBe("deny");
    const r2 = await service.check(
      CONV,
      body({ intents: [{ action: "git.push" }, { action: "delete" }] }),
    );
    expect(r2.decision).toBe("pending");
    const [a] = await pending();
    expect(a).toMatchObject({ action: "delete", risk: "high" });
  });

  it("denies unclassified", async () => {
    const r = await service.check(CONV, body({ intent: { action: "unclassified" } }));
    expect(r.decision).toBe("deny");
  });

  it("denies a hash mismatch", async () => {
    const r = await service.check(CONV, { ...body(), hash: "0".repeat(64) });
    expect(r.decision).toBe("deny");
    expect(await approvals.list()).toHaveLength(0);
  });

  it("denies while paused", async () => {
    paused = true;
    expect((await service.check(CONV, body())).decision).toBe("deny");
  });

  it("denies a command over 20000 characters", async () => {
    const r = await service.check(CONV, body({ input: { command: "x".repeat(20_001) } }));
    expect(r.decision).toBe("deny");
  });

  it("denies a chained command that names the data dir, whatever the top action", async () => {
    evaluation = { decision: "allow", ruleId: "r" };
    const command = `cp x ${dataDir()}/gate-rules.json && git push`;
    const r = await service.check(
      CONV,
      body({ input: { command }, intent: { action: "git.push" } }),
    );
    expect(r.decision).toBe("deny");
    expect(await approvals.list()).toHaveLength(0);
  });

  it("denies a data-dir overwrite", async () => {
    const command = `echo '[]' > ${dataDir()}/gate-rules.json`;
    expect((await service.check(CONV, body({ input: { command } }))).decision).toBe("deny");
  });

  it("creates exactly one approval and one widget on ask", async () => {
    const r = await service.check(CONV, body());
    const all = await approvals.list();
    expect(all).toHaveLength(1);
    expect(widgets).toEqual([{ kind: "approval", approvalId: all[0]?.id }]);
    expect(r).toEqual({ decision: "pending", approvalId: all[0]?.id });
    const a = all[0];
    expect(a?.kind).toBe("chat");
    expect(a?.runId).toBe(
      `${CONV}/${chatGateHash("shell", { command: "echo hi > /tmp/x" }).slice(0, 16)}`,
    );
    expect(a?.risk).toBe("medium");
  });

  it("keeps riskType and the full untruncated command in detail", async () => {
    const command = `cat > /tmp/b.md <<'EOF'\n${"line\n".repeat(2000)}EOF`;
    const context = JSON.stringify({
      riskType: "mazani",
      summary: "s",
      preview: { kind: "command", cmd: "TRUNCATED…" },
    });
    await service.check(
      CONV,
      body({ input: { command }, intent: { action: "overwrite", context } }),
    );
    const detail = JSON.parse((await pending())[0]?.detail ?? "{}") as {
      riskType: string;
      preview: { cmd: string };
    };
    expect(detail.riskType).toBe("mazani");
    expect(detail.preview.cmd).toBe(command);
  });

  it("builds the detail for a plain-text context and for an MCP call", async () => {
    await service.check(
      CONV,
      body({
        tool: "srv_write",
        input: { a: 1 },
        intent: { action: "mcp.write", scope: "srv", tool: "write", context: "plain" },
      }),
    );
    const detail = JSON.parse((await pending())[0]?.detail ?? "{}") as {
      summary: string;
      preview: { cmd: string };
    };
    expect(detail.summary).toBe("plain");
    expect(detail.preview.cmd).toBe('srv · write {\n  "a": 1\n}');
  });

  it("rejects the approval and denies when no turn is in flight", async () => {
    turnInFlight = false;
    const r = await service.check(CONV, body());
    expect(r.decision).toBe("deny");
    const all = await approvals.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.status).toBe("rejected");
  });

  describe("status", () => {
    it("is 404 for another conversation's approval and for a non-chat one", async () => {
      const r = await service.check(CONV, body());
      const id = r.decision === "pending" ? r.approvalId : "";
      await expect(service.status("conv_2", id)).rejects.toBeInstanceOf(ApprovalNotFoundError);
      const other = await approvals.requestApproval({
        runId: `${CONV}/abc`,
        kind: "agent",
        skill: "s",
        action: "a",
        detail: "d",
        risk: "low",
      });
      await expect(service.status(CONV, other.id)).rejects.toBeInstanceOf(ApprovalNotFoundError);
    });

    it("reports pending, then the operator's decision", async () => {
      const r = await service.check(CONV, body());
      const id = r.decision === "pending" ? r.approvalId : "";
      expect(await service.status(CONV, id)).toEqual({ status: "pending" });
      await approvals.approve(id);
      expect(await service.status(CONV, id)).toEqual({ status: "approved" });
    });

    it("expires a pending approval past the deadline; a late approve gets 409", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const r = await service.check(CONV, body());
      const id = r.decision === "pending" ? r.approvalId : "";
      vi.setSystemTime(Date.now() + CHAT_APPROVAL_WAIT_MS + 1000);
      expect(await service.status(CONV, id)).toEqual({ status: "rejected" });
      expect((await approvals.get(id)).reason).toMatch(/^Expired/);
      await expect(approvals.approve(id)).rejects.toBeInstanceOf(ApprovalAlreadyDecidedError);
    });
  });

  it("settleTurn rejects only this conversation's pending chat approvals", async () => {
    const a = await service.check(CONV, body());
    const b = await service.check("conv_2", body({ input: { command: "echo other" } }));
    await service.settleTurn(CONV);
    const ids = {
      a: a.decision === "pending" ? a.approvalId : "",
      b: b.decision === "pending" ? b.approvalId : "",
    };
    expect((await approvals.get(ids.a)).status).toBe("rejected");
    expect((await approvals.get(ids.a)).reason).toMatch(/^Chat turn ended/);
    expect((await approvals.get(ids.b)).status).toBe("pending");
  });

  it("onModuleInit sweeps only stale pending chat approvals", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const old = await service.check(CONV, body());
    vi.setSystemTime(Date.now() + CHAT_APPROVAL_WAIT_MS + 1000);
    const fresh = await service.check(CONV, body({ input: { command: "echo fresh" } }));
    await service.onModuleInit();
    expect((await approvals.get(old.decision === "pending" ? old.approvalId : "")).status).toBe(
      "rejected",
    );
    expect((await approvals.get(fresh.decision === "pending" ? fresh.approvalId : "")).status).toBe(
      "pending",
    );
  });
});
