import { describe, expect, it } from "vitest";
import { AutopilotStateSchema, SetAutopilotInputSchema, autopilotContract } from "../index";

describe("autopilotContract", () => {
  it("exposes GET and PUT /api/autopilot", () => {
    expect(autopilotContract.getAutopilot.path).toBe("/api/autopilot");
    expect(autopilotContract.setAutopilot.method).toBe("PUT");
  });

  it("accepts paused and a level tree, rejects the old level and unknown keys", () => {
    expect(SetAutopilotInputSchema.safeParse({ paused: true }).success).toBe(true);
    expect(SetAutopilotInputSchema.safeParse({}).success).toBe(true);
    expect(SetAutopilotInputSchema.safeParse({ paused: "yes" }).success).toBe(false);
    expect(SetAutopilotInputSchema.safeParse({ level: "full" }).success).toBe(false);
    expect(SetAutopilotInputSchema.safeParse({ paused: false, by: "operator" }).success).toBe(
      false,
    );
    expect(AutopilotStateSchema.safeParse({ paused: false, sneaky: 1 }).success).toBe(false);
  });
});
