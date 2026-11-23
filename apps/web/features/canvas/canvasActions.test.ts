import { describe, expect, it } from "vitest";
import { formatErrorLog, sanitizeFilename, zibbyHrefToPath } from "./canvasActions";

describe("zibbyHrefToPath", () => {
  it("maps dashboard segments", () => {
    expect(zibbyHrefToPath("zibby://agents")).toBe("/agents");
    expect(zibbyHrefToPath("zibby://runs/abc?tab=1")).toBe("/runs/abc?tab=1");
    expect(zibbyHrefToPath("zibby://settings/")).toBe("/settings/");
  });
  it("rejects unknown segments and other schemes", () => {
    expect(zibbyHrefToPath("zibby://evil/x")).toBeNull();
    expect(zibbyHrefToPath("zibby://agentsx")).toBeNull();
    expect(zibbyHrefToPath("https://agents/x")).toBeNull();
    expect(zibbyHrefToPath("zibby://agents\\x")).toBeNull();
    expect(zibbyHrefToPath(5)).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("strips separators and control chars, caps, falls back", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFilename("a\u0000b\\c.txt")).toBe("abc.txt");
    expect(sanitizeFilename("x".repeat(300))).toHaveLength(120);
    expect(sanitizeFilename("///")).toBe("download");
    expect(sanitizeFilename(undefined)).toBe("download");
  });
});

describe("formatErrorLog", () => {
  it("fences and caps the log", () => {
    const out = formatErrorLog([{ message: "boom", stack: "at x" }]);
    expect(out).toBe("```\nboom\nat x\n```");
    expect(formatErrorLog([{ message: "y".repeat(9000) }]).length).toBeLessThan(4020);
    expect(formatErrorLog([{ message: "```" }])).not.toContain("``` ");
  });
});
