import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a custom text size next to a text colour, still merges two sizes", () => {
    expect(cn("text-meta", "text-ink-3")).toBe("text-meta text-ink-3");
    expect(cn("text-meta", "text-body")).toBe("text-body");
  });
});
