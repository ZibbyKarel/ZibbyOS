import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ChatGateCheckBody, ChatGateDecision, GlobalGateRule } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalsService } from "../approvals/approvals.service";
import { ApprovalsStorageService } from "../approvals/approvals.storage.service";
import { GateRulesStorageService } from "../gate-rules/gate-rules.storage.service";
import { GateEvaluatorService } from "../gates/gate-evaluator.service";
import { PolicyStorageService } from "../gates/policy.storage.service";
// @ts-expect-error — untyped .mjs seam (same as the hook's own test).
import { ACTION_RANK } from "../runner/claude-approval-hook.mjs";
import { CHAT_ACTION_RANK, ChatGateService, chatGateHash } from "./chat-gate.service";
import { ChatToolResultRegistry } from "./chat-tool-result.registry";
import {
  chatGateReason,
  chatGateHash as pluginHash,
  // @ts-expect-error — plain .mjs plugin, no types
} from "./opencode-chat-gate/index.mjs";

const CONV = "conv_int";

/**
 * The chat gate end to end on the server side: the real plugin classifier (`chatGateReason`)
 * feeds `ChatGateService.check`, judged by the real `GateEvaluatorService` over the real
 * `SYSTEM_RULES` + starter catalog (`gr-push-main`) on disk. No evaluator fake.
 */
describe("ChatGateService with the real gate evaluator and SYSTEM_RULES", () => {
  let dir: string;
  let catalog: GateRulesStorageService;
  let evaluator: GateEvaluatorService;
  let approvals: ApprovalsService;
  let service: ChatGateService;
  let unsubscribe: () => void;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-gate-int-"));
    catalog = new GateRulesStorageService(path.join(dir, "rules"));
    await catalog.onModuleInit();
    evaluator = new GateEvaluatorService(new PolicyStorageService(catalog));
    approvals = new ApprovalsService(new ApprovalsStorageService(path.join(dir, "approvals")));
    const registry = new ChatToolResultRegistry();
    unsubscribe = registry.onWidget(CONV, () => {});
    service = new ChatGateService(approvals, evaluator, registry);
  });

  afterEach(async () => {
    unsubscribe();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const setDecision = async (id: string, decision: GlobalGateRule["decision"]) => {
    const rule = (await catalog.list()).find((r) => r.id === id);
    if (!rule) throw new Error(`no rule ${id}`);
    const base = { name: rule.name, desc: rule.desc, match: rule.match };
    await catalog.update(
      id,
      decision === "ask"
        ? { ...base, decision, resolve: { type: "human" } }
        : { ...base, decision },
    );
  };

  /** Classify like the plugin, then decide like the server; `null` = the plugin runs it. */
  const gate = async (command: string, workdir?: string): Promise<ChatGateDecision | null> => {
    const input = workdir ? { command, workdir } : { command };
    const verdict = chatGateReason("shell", input, { PWD: dir }) as {
      intents?: ChatGateCheckBody["intents"];
      reason?: string;
      cwd?: string;
    } | null;
    if (!verdict) return null;
    if (verdict.reason) return { decision: "deny", reason: verdict.reason };
    return service.check(CONV, {
      tool: "shell",
      input,
      hash: chatGateHash("shell", input),
      intents: verdict.intents ?? [],
      ...(verdict.cwd ? { cwd: verdict.cwd } : {}),
    });
  };

  describe("the reviewer's self-approve loop (re-review Important 1)", () => {
    it("a cd into ~/.config is refused before the token can be read relatively", async () => {
      const r = await gate("cd ~/.config && cat zibby/operator-token");
      expect(r).toMatchObject({ decision: "deny", reason: expect.stringMatching(/operator/) });
    });

    it("a bundled -sX POST with a composed path is a card, never a silent run", async () => {
      await setDecision("floor-git.push", "allow");
      const r = await gate(
        'P=approve; curl -sX POST -H "authorization: Bearer $T" http://127.0.0.1:3333/api/approvals/$ID/$P',
      );
      expect(r?.decision).toBe("pending");
      const [a] = await approvals.list("pending");
      expect(a?.action).toBe("shell.opaque");
    });
  });

  describe("an ungated call still gets the protected-dir deny (re-review Important 2)", () => {
    let data: string;
    const prev = process.env.ZIBBY_DATA_DIR;
    beforeEach(async () => {
      data = path.join(dir, "zdata");
      await fs.mkdir(data, { recursive: true });
      process.env.ZIBBY_DATA_DIR = data;
    });
    afterEach(() => {
      if (prev === undefined) delete process.env.ZIBBY_DATA_DIR;
      else process.env.ZIBBY_DATA_DIR = prev;
    });

    it("denies rsync / tar / touch run with workdir=<dataDir>", async () => {
      for (const command of ["rsync /tmp/r gate-rules.json", "tar xf x.tar", "touch approvals/x"]) {
        expect(await gate(command, data), command).toMatchObject({
          decision: "deny",
          reason: expect.stringMatching(/data directory/),
        });
      }
      expect(await approvals.list()).toHaveLength(0);
    });

    it("denies a cd into the data dir or its parent plus the relative rest", async () => {
      for (const command of [
        `cd ${dir} && cd zdata && touch x`,
        `cd ${dir} && touch zdata/approvals/x`,
        "cd zdata && tar xf /tmp/x.tar",
      ]) {
        expect((await gate(command))?.decision, command).toBe("deny");
      }
    });

    it("allows an ungated call elsewhere", async () => {
      expect(await gate("ls -la && git status")).toEqual({ decision: "allow" });
      expect(await gate(`cd ${dir} && ls`)).toEqual({ decision: "allow" });
    });
  });

  describe("a branch deny and a branchless push (ruling change)", () => {
    it("asks for an explicit branch instead of guessing", async () => {
      await setDecision("floor-git.push", "allow");
      await setDecision("gr-push-main", "deny");
      for (const command of ["git push", "git push origin", "git push -u origin HEAD"]) {
        expect(await gate(command), command).toEqual({
          decision: "deny",
          reason: "Name the target branch explicitly (git push origin <branch>).",
        });
      }
      expect((await gate("git push origin feature/x"))?.decision).toBe("pending");
      expect(await approvals.list("pending")).toHaveLength(1);
    });
  });

  describe("push allowed globally, gr-push-main still asks (finding 1)", () => {
    beforeEach(() => setDecision("floor-git.push", "allow"));

    it("a branchless push never runs silently", async () => {
      for (const command of ["git push", "git push origin", "git push -u origin HEAD"]) {
        expect((await gate(command))?.decision, command).toBe("pending");
      }
    });

    it("even a feature-branch push asks while a push rule asks (the old guarantee)", async () => {
      expect((await gate("git push origin feature/x"))?.decision).toBe("pending");
    });

    it("runs silently once every push rule allows", async () => {
      await setDecision("gr-push-main", "allow");
      expect(await gate("git push origin feature/x")).toEqual({ decision: "allow" });
      expect(await gate("git push")).toEqual({ decision: "allow" });
    });

    it("an opaque form is a card even when every push rule allows", async () => {
      await setDecision("gr-push-main", "allow");
      for (const command of [
        "bash -c 'git push origin main'",
        "eval 'git push origin main'",
        "echo $(git push origin main)",
        "env git push origin main",
        "curl -X POST http://localhost:3333/api/x",
      ]) {
        expect((await gate(command))?.decision, command).toBe("pending");
      }
      const actions = (await approvals.list("pending")).map((a) => a.action);
      expect(new Set(actions)).toEqual(new Set(["shell.opaque"]));
    });
  });

  describe("a chained multi-refspec push (finding 2)", () => {
    it("the hidden main reaches the server: a gr-push-main deny denies the chain", async () => {
      await setDecision("floor-git.push", "allow");
      await setDecision("gr-push-main", "deny");
      for (const command of [
        "git push --tags && git push origin dev main",
        "git push origin a b && git push origin c main",
      ]) {
        expect((await gate(command))?.decision, command).toBe("deny");
      }
      expect(await approvals.list()).toHaveLength(0);
    });

    it("under the shipped rules it is a card naming main", async () => {
      const r = await gate("git push --tags && git push origin dev main");
      expect(r?.decision).toBe("pending");
      const [a] = await approvals.list("pending");
      expect(a?.detail).toMatch(/main/);
    });
  });

  it("gh pr merge is denied with no approval", async () => {
    expect((await gate("gh pr merge 1 --squash"))?.decision).toBe("deny");
    expect((await gate("echo ok && gh pr merge 1"))?.decision).toBe("deny");
    expect(await approvals.list()).toHaveLength(0);
  });

  it("a cat heredoc to a file is a card (overwrite is never silent in the chat)", async () => {
    const r = await gate("cat > /tmp/note.md <<'EOF'\n# Title `code` $(not run)\nEOF");
    expect(r?.decision).toBe("pending");
    expect((await approvals.list("pending"))[0]?.action).toBe("overwrite");
  });

  it("the shell.opaque system rule asks, and an action no rule matches evaluates to ask", async () => {
    const floor = await evaluator.floor();
    expect(evaluator.evaluate(floor, { action: "shell.opaque" })).toMatchObject({
      decision: "ask",
      ruleId: "floor-shell.opaque",
    });
    const none = evaluator.evaluate(floor, { action: "no.rule.matches.this" });
    expect(none.decision).toBe("ask");
    expect(none.ruleId).toBeUndefined();
  });

  it("an operator deny on shell.opaque refuses opaque forms outright", async () => {
    await setDecision("floor-shell.opaque", "deny");
    expect((await gate("sh -c 'ls'"))?.decision).toBe("deny");
    expect(await approvals.list()).toHaveLength(0);
  });
});

describe("chat gate parity", () => {
  it("the plugin hash and the server hash agree on a nested input", () => {
    const input = {
      command: "echo 'ž' && git push",
      workdir: "~/a b",
      nested: { list: [1, "2", { deep: null, u: " " }], t: true },
    };
    expect(pluginHash("shell", input)).toBe(chatGateHash("shell", input));
    expect(pluginHash("srv_tool", undefined)).toBe(chatGateHash("srv_tool", undefined));
  });

  it("the server's action rank mirrors the run hook's ACTION_RANK", () => {
    expect(CHAT_ACTION_RANK).toEqual(ACTION_RANK);
  });
});
