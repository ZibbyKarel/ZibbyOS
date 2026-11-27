import { describe, expect, it } from "vitest";
import { parseAuthCookies } from "./ConnectedServiceDialog";

describe("parseAuthCookies", () => {
  it("parses host: names lines", () => {
    expect(parseAuthCookies(".etsy.com: uaid, user_prefs")).toEqual([
      { host: ".etsy.com", names: ["uaid", "user_prefs"] },
    ]);
  });
  it("strips a scheme://", () => {
    expect(parseAuthCookies("https://www.etsy.com: uaid")).toEqual([
      { host: "www.etsy.com", names: ["uaid"] },
    ]);
  });
  it("strips a leading scheme and rejects a path host and lines without names", () => {
    expect(parseAuthCookies("https://www.etsy.com/shop: uaid")).toBeNull();
    expect(parseAuthCookies("etsy.com")).toBeNull();
  });
});
