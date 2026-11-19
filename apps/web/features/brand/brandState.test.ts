import { stateToneHex } from "@zibby/design-system";
import { describe, expect, it } from "vitest";
import { deriveBrandState, faviconDataUri } from "./brandState";

describe("deriveBrandState", () => {
  it("is amber when approvals are pending or a run waits", () => {
    expect(deriveBrandState({ pendingApprovals: 1, runStatuses: ["running"] })).toBe("blocked");
    expect(deriveBrandState({ pendingApprovals: 0, runStatuses: ["parked"] })).toBe("blocked");
    expect(deriveBrandState({ pendingApprovals: 0, runStatuses: ["awaiting-approval"] })).toBe(
      "blocked",
    );
  });
  it("is violet while only running, grey when calm", () => {
    expect(deriveBrandState({ pendingApprovals: 0, runStatuses: ["done", "running"] })).toBe(
      "working",
    );
    expect(deriveBrandState({ pendingApprovals: 0, runStatuses: ["done"] })).toBe("idle");
    expect(deriveBrandState({ pendingApprovals: 0, runStatuses: [] })).toBe("idle");
  });
});

describe("faviconDataUri", () => {
  it.each(["blocked", "working", "idle"] as const)("paints the %s knot", (state) => {
    const svg = decodeURIComponent(faviconDataUri(state).replace("data:image/svg+xml,", ""));
    expect(svg).toContain(`r="6.5" fill="${stateToneHex[state]}"`);
  });
});
