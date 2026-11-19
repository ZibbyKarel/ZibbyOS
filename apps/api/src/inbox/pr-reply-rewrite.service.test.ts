import { describe, expect, it } from "vitest";
import {
  PrReplyRewriteService,
  ReplyRewriteError,
  replyFromEnvelope,
  rewritePrompt,
} from "./pr-reply-rewrite.service";

class Fake extends PrReplyRewriteService {
  constructor(private readonly out: string | Error) {
    super();
  }
  protected override async run(): Promise<string> {
    if (this.out instanceof Error) throw this.out;
    return this.out;
  }
}

describe("PrReplyRewriteService", () => {
  it("builds a mode-specific prompt that keeps the draft and comment as data", () => {
    const p = rewritePrompt({ body: "Fixed in abc1234.", mode: "longer", comment: "rename x" });
    expect(p).toContain("more detailed");
    expect(p).toContain("rename x");
    expect(p).toContain("Fixed in abc1234.");
    expect(rewritePrompt({ body: "b", mode: "shorter" })).toContain("more concise");
  });

  it("unwraps the envelope and code fences", () => {
    expect(replyFromEnvelope(JSON.stringify({ result: "  Fixed in abc.  " }))).toBe(
      "Fixed in abc.",
    );
    expect(replyFromEnvelope("```\nFixed.\n```")).toBe("Fixed.");
  });

  it("returns the rewrite and refuses an empty result or a failed call", async () => {
    const input = { body: "Fixed in abc1234, thanks!", mode: "shorter" as const };
    await expect(
      new Fake(JSON.stringify({ result: "Fixed in abc1234." })).rewrite(input),
    ).resolves.toBe("Fixed in abc1234.");
    await expect(new Fake(JSON.stringify({ result: "  " })).rewrite(input)).rejects.toBeInstanceOf(
      ReplyRewriteError,
    );
    await expect(new Fake(new Error("timeout")).rewrite(input)).rejects.toBeInstanceOf(
      ReplyRewriteError,
    );
  });
});
