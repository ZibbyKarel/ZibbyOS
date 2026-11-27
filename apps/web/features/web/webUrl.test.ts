import { describe, expect, it } from "vitest";
import { normalizeWebUrl } from "./webUrl";

describe("normalizeWebUrl (todo-19)", () => {
  it("keeps http(s) URLs", () => {
    expect(normalizeWebUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(normalizeWebUrl("http://example.com")).toBe("http://example.com/");
  });

  it("adds https:// to bare domains, with port and path", () => {
    expect(normalizeWebUrl("  example.com ")).toBe("https://example.com/");
    expect(normalizeWebUrl("example.com/x?y=1")).toBe("https://example.com/x?y=1");
    expect(normalizeWebUrl("localhost:3000/app")).toBe("https://localhost:3000/app");
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "mailto:a@b.cz",
    "data:text/html,x",
    "ftp://example.com",
    "two words.com",
    "singleword",
    "",
    "   ",
  ])("rejects %s", (raw) => expect(normalizeWebUrl(raw)).toBeNull());
});
