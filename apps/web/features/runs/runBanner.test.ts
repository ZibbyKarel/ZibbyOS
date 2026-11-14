import { describe, expect, it } from "vitest";
import { pickRunBanner } from "./runBanner";
import type { RunMode } from "./runDetailModel";

describe("pickRunBanner", () => {
  it.each<[RunMode, boolean, ReturnType<typeof pickRunBanner>]>([
    ["approval", true, "approval"],
    ["approval", false, null],
    ["question", true, "question"],
    ["question", false, null],
    ["error", false, "error"],
    ["parked", false, "parked"],
    ["limit", false, "limit"],
    ["running", true, null],
    ["pausing", false, null],
    ["paused", false, null],
    ["waiting", true, null],
    ["stopped", false, null],
    ["done", false, null],
  ])("%s (approval: %s) → %s", (mode, hasApproval, expected) => {
    expect(pickRunBanner(mode, hasApproval)).toBe(expected);
  });
});
