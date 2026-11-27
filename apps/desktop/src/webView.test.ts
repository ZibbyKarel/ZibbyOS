import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({}));

const { parseWebUrl, toViewBounds } = await import("./webView");

describe("parseWebUrl (todo-19)", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(parseWebUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(parseWebUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/html,x",
    "about:blank",
    "example.com",
    "",
    5,
    null,
  ])("rejects %s", (raw) => expect(parseWebUrl(raw)).toBeNull());
});

describe("toViewBounds (todo-19)", () => {
  it("rounds to whole pixels and clamps negative sizes", () => {
    expect(toViewBounds({ x: 10.4, y: 20.6, width: 300.2, height: -5 })).toEqual({
      x: 10,
      y: 21,
      width: 300,
      height: 0,
    });
  });

  it("rejects non-numeric or missing fields", () => {
    expect(toViewBounds({ x: 1, y: 2, width: "a", height: 4 })).toBeNull();
    expect(toViewBounds({ x: 1 })).toBeNull();
    expect(toViewBounds(null)).toBeNull();
  });
});
