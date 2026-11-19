import { describe, expect, it } from "vitest";
import { safeMarkdownLinks } from "./day-overview.service";

describe("safeMarkdownLinks", () => {
  it("keeps http(s) links and degrades others to their label", () => {
    expect(safeMarkdownLinks("[a](https://x.cz/y) [b](javascript:x) [c](/rel)")).toBe(
      "[a](https://x.cz/y) b c",
    );
  });
});
