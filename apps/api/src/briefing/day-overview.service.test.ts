import { mkdtemp, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { localDate } from "../memory/vault.service";
import { CHAT_PERSONAS } from "../chat/chat-persona";
import { DayOverviewService, prAppUrl, safeMarkdownLinks } from "./day-overview.service";

describe("safeMarkdownLinks", () => {
  it("keeps http(s) links and app-relative paths, degrades the rest to their label", () => {
    expect(
      safeMarkdownLinks(
        "[a](https://x.cz/y) [b](javascript:x) [c](/activity/runs/r1) [d](//evil.cz/x) [e](rel)",
      ),
    ).toBe("[a](https://x.cz/y) b [c](/activity/runs/r1) d e");
  });
});

describe("prAppUrl", () => {
  it("maps a PR / MR url to the PR screen and ignores other urls", () => {
    expect(prAppUrl("https://github.com/o/r/pull/7")).toBe(
      `/dashboard/inbox/pull-requests?pr=${encodeURIComponent("https://github.com/o/r/pull/7")}`,
    );
    expect(prAppUrl("https://github.com/o/r/issues/7")).toBeUndefined();
  });
});

describe("DayOverviewService personality", () => {
  const make = async (persona: { value: string }) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "day-overview-"));
    const prompts: string[] = [];
    class Svc extends DayOverviewService {
      protected override run(prompt: string): Promise<string> {
        prompts.push(prompt);
        return Promise.resolve(`text ${prompts.length}`);
      }
    }
    const svc = new Svc(
      { assemble: vi.fn().mockResolvedValue({ needsYou: [], reminders: [] }) } as never,
      { list: vi.fn().mockResolvedValue([]) } as never,
      { note: vi.fn().mockResolvedValue(null) } as never,
      dir,
      { current: () => ({ chatPersona: persona.value }) } as never,
    );
    return { svc, prompts, dir };
  };

  it("feeds the selected personality into the prompt and regenerates when it changes", async () => {
    const persona = { value: "jarvis" };
    const { svc, prompts } = await make(persona);
    await svc.current();
    expect(prompts[0]).toContain("butler s osobností");
    await svc.current();
    expect(prompts).toHaveLength(1); // cached for the same personality
    persona.value = "concise";
    const next = await svc.current();
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Mluv co nejstručněji");
    expect(next.markdown).toBe("text 2");
  });

  it("addresses the operator as pane in jarvis and formal, not in concise", () => {
    expect(CHAT_PERSONAS.jarvis).toContain("„pane“");
    expect(CHAT_PERSONAS.formal).toContain("„pane“");
    expect(CHAT_PERSONAS.concise).not.toContain("„pane“");
  });

  it("regenerates a cache written before the voice fingerprint existed", async () => {
    const { svc, prompts, dir } = await make({ value: "jarvis" });
    const date = localDate(new Date());
    await writeFile(
      path.join(dir, "day-overview.json"),
      JSON.stringify({
        date,
        generatedAt: new Date().toISOString(),
        markdown: "old",
        persona: "jarvis",
      }),
    );
    expect((await svc.current()).markdown).toBe("text 1");
    expect(prompts).toHaveLength(1);
  });

  it("reuses a cache written by refresh() on the same day", async () => {
    const { svc, prompts } = await make({ value: "jarvis" });
    await svc.refresh();
    await svc.current();
    expect(prompts).toHaveLength(1);
  });
});

describe("DayOverviewService goals", () => {
  const goal = { id: "pub", name: "Publikační dávka", enabled: true, createdAt: "x" };
  const make = async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "day-overview-"));
    const prompts: string[] = [];
    const instance: Record<string, unknown> = {
      status: "parked",
      parkedReason: "failed",
      summary: "všech 17 úloh spadlo",
      taskIds: [],
    };
    class Svc extends DayOverviewService {
      protected override run(prompt: string): Promise<string> {
        prompts.push(prompt);
        return Promise.resolve(`text ${prompts.length}`);
      }
    }
    const svc = new Svc(
      { assemble: vi.fn().mockResolvedValue({ needsYou: [], reminders: [] }) } as never,
      { list: vi.fn().mockResolvedValue([]) } as never,
      { note: vi.fn().mockResolvedValue(null) } as never,
      dir,
      undefined,
      undefined,
      {
        list: vi.fn().mockResolvedValue([goal, { ...goal, id: "off", enabled: false }]),
      } as never,
      { read: vi.fn(async () => ({ instances: { web: { ...instance } } })) } as never,
    );
    return { svc, prompts, instance };
  };

  it("puts every enabled goal's current state into the prompt", async () => {
    const { svc, prompts } = await make();
    await svc.current();
    expect(prompts[0]).toContain('"appUrl":"/work/goals/pub"');
    expect(prompts[0]).toContain('"status":"needs-you"');
    expect(prompts[0]).toContain("všech 17 úloh spadlo");
    expect(prompts[0]).not.toContain("/work/goals/off");
  });

  it("rewrites today's text when a goal's state changes, not otherwise", async () => {
    const { svc, prompts, instance } = await make();
    await svc.current();
    await svc.current();
    expect(prompts).toHaveLength(1);
    instance.status = "acting";
    expect((await svc.current()).markdown).toBe("text 2");
    // acting ↔ waiting is the same "being worked on": no rewrite.
    instance.status = "waiting";
    await svc.current();
    expect(prompts).toHaveLength(2);
    // The old park summary no longer describes a running instance.
    expect(prompts[1]).not.toContain("všech 17 úloh spadlo");
  });

  it("writes once for concurrent reads", async () => {
    const { svc, prompts } = await make();
    await Promise.all([svc.current(), svc.current()]);
    expect(prompts).toHaveLength(1);
  });
});
