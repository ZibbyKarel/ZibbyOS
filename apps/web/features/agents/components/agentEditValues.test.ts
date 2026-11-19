import { describe, expect, it } from "vitest";
import type { Agent } from "@zibby/contracts";
import { applyFormValues, dirtySections, toFormValues } from "./agentEditValues";

const AGENT: Agent = { id: "r", name: "r", instructions: "Do it.", tools: ["read"] };

describe("dirtySections", () => {
  it("is empty for identical values", () => {
    expect(dirtySections(toFormValues(AGENT), toFormValues(AGENT))).toEqual([]);
  });

  it("names every changed card once, in bar order", () => {
    const saved = toFormValues(AGENT);
    const now = {
      ...saved,
      instructions: "Changed",
      tools: ["read", "git"],
      requiresApproval: true,
      model: "opus" as const,
      displayName: "R",
    };
    expect(dirtySections(saved, now)).toEqual(["instructions", "identity", "engine", "tools"]);
  });
});

describe("applyFormValues", () => {
  it("leaves absent advanced fields out", () => {
    const out = applyFormValues(AGENT, toFormValues(AGENT));
    expect(out).not.toHaveProperty("requires_approval");
    expect(out).not.toHaveProperty("plugins");
    expect(out.risk).toBeUndefined();
  });

  it("sends explicit false / [] to clear fields the agent had", () => {
    const had: Agent = { ...AGENT, requires_approval: true, plugins: ["/p"], optionalTools: ["a"] };
    const out = applyFormValues(had, {
      ...toFormValues(had),
      requiresApproval: false,
      plugins: [],
      optionalTools: [],
    });
    expect(out.requires_approval).toBe(false);
    expect(out.plugins).toEqual([]);
    expect(out.optionalTools).toEqual([]);
  });
});
