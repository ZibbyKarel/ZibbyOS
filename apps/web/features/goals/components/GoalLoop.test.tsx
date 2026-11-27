import { describe, expect, it } from "vitest";
import type { GoalRollup, GoalRollupStatus, GoalState } from "@zibby/contracts";
import { LoopDiagramTestId } from "@zibby/design-system";
import { renderWithProviders as render, screen } from "../../../test/render";
import { GoalLoop } from "./GoalLoop";

const RUN = "var(--color-run)";

const state: GoalState = {
  goalId: "g",
  cycle: { index: 4, startedAt: "2026-11-26T10:00:00.000Z" },
  instances: {
    alpha: { status: "done", taskIds: ["t1"] },
    beta: { status: "acting", taskIds: ["t2", "t3"] },
  },
  decisionsThisMonth: { month: "2026-11", count: 0 },
  nudges: {},
};

const rollup = (status: GoalRollupStatus): GoalRollup => ({
  status,
  counts: { total: 2, done: 1, parked: 0, active: 1 },
  needsYou: 0,
});

describe("GoalLoop", () => {
  it("lights the forward arrow while acting", () => {
    render(<GoalLoop goal={{ enabled: true }} rollup={rollup("acting")} state={state} />);
    expect(screen.getByTestId(LoopDiagramTestId.ForwardArrow)).toHaveAttribute("stroke", RUN);
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).not.toHaveAttribute("stroke", RUN);
  });

  it("lights the back arrow while planning", () => {
    render(<GoalLoop goal={{ enabled: true }} rollup={rollup("planning")} state={state} />);
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).toHaveAttribute("stroke", RUN);
    expect(screen.getByTestId(LoopDiagramTestId.ForwardArrow)).not.toHaveAttribute("stroke", RUN);
  });

  it("rests, dashes the back arrow and names the pause when it needs the operator", () => {
    render(<GoalLoop goal={{ enabled: true }} rollup={rollup("needs-you")} state={state} />);
    expect(screen.getByTestId(LoopDiagramTestId.ForwardArrow)).not.toHaveAttribute("stroke", RUN);
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).toHaveAttribute(
      "stroke-dasharray",
      "4 4",
    );
    expect(screen.getByTestId(LoopDiagramTestId.BackLabel)).toHaveTextContent("čeká na tebe");
  });

  it("counts done of total projects for a one-off goal", () => {
    render(<GoalLoop goal={{ enabled: true }} rollup={rollup("acting")} state={state} />);
    expect(screen.getByTestId(LoopDiagramTestId.Count)).toHaveTextContent("1 / 2");
  });

  it("counts the cycle (from 1) for a standing goal", () => {
    render(
      <GoalLoop
        goal={{ enabled: true, cadence: { every: "day", hour: 9 } }}
        rollup={rollup("acting")}
        state={state}
      />,
    );
    expect(screen.getByTestId(LoopDiagramTestId.Count)).toHaveTextContent("5");
  });
});
