import { mkdtemp } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
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
    return { svc, prompts };
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
});
