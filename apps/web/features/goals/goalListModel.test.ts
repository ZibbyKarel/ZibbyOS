import { describe, expect, it } from "vitest";
import type { TaskRun } from "@zibby/contracts";
import { goalFilterOf, goalVerdict } from "./goalListModel";

const run = (status: string, iterations: unknown[]) =>
  ({ status, iterations }) as unknown as TaskRun;
const iter = (index: number, status: string, satisfied: boolean, output: string) => ({
  index,
  status,
  verifier: { satisfied, output },
});

describe("goalFilterOf", () => {
  it("buckets state tones into the status chips", () => {
    expect(goalFilterOf("working")).toBe("active");
    expect(goalFilterOf("thinking")).toBe("active");
    expect(goalFilterOf("blocked")).toBe("parked");
    expect(goalFilterOf("done")).toBe("done");
    expect(goalFilterOf("error")).toBe("error");
    expect(goalFilterOf("idle")).toBe("idle");
  });
});

describe("goalVerdict", () => {
  it("is none without a run or iterations", () => {
    expect(goalVerdict(undefined).outcome).toBe("none");
    expect(goalVerdict(run("running", [])).outcome).toBe("none");
  });

  it("reads the latest iteration and collapses whitespace", () => {
    const v = goalVerdict(
      run("running", [iter(0, "done", false, "a"), iter(1, "done", false, "x\n\n y")]),
    );
    expect(v).toEqual({ outcome: "failed", iteration: 2, text: "x y" });
  });

  it("lets run state override the iteration outcome", () => {
    expect(goalVerdict(run("parked", [iter(0, "done", false, "x")])).outcome).toBe("parked");
    expect(goalVerdict(run("error", [iter(0, "done", true, "x")])).outcome).toBe("error");
    expect(goalVerdict(run("done", [iter(0, "done", true, "ok")])).outcome).toBe("passed");
    expect(goalVerdict(run("running", [iter(0, "running", false, "")])).outcome).toBe("running");
  });

  it("truncates long text", () => {
    const v = goalVerdict(run("done", [iter(0, "done", true, "w".repeat(400))]));
    expect(v.text?.length).toBe(160);
    expect(v.text?.endsWith("…")).toBe(true);
  });
});
