import { describe, expect, it } from "vitest";
import { isCompanyArmed } from "./machine.schema";

describe("isCompanyArmed", () => {
  it("arms everything when companies is missing or empty", () => {
    expect(isCompanyArmed("acme", undefined)).toBe(true);
    expect(isCompanyArmed("acme", {})).toBe(true);
    expect(isCompanyArmed("acme", { companies: [] })).toBe(true);
  });
  it("always arms work with no company", () => {
    expect(isCompanyArmed(undefined, { companies: ["a"] })).toBe(true);
    expect(isCompanyArmed(null, { companies: ["a"] })).toBe(true);
  });
  it("arms only listed companies otherwise", () => {
    expect(isCompanyArmed("a", { companies: ["a", "b"] })).toBe(true);
    expect(isCompanyArmed("c", { companies: ["a", "b"] })).toBe(false);
  });
});
