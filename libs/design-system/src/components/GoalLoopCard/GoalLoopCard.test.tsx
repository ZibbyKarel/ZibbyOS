import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoalLoopCard, GoalLoopCardTestId } from "./GoalLoopCard";

const base = {
  state: "blocked" as const,
  stateLabel: "Parked",
  title: "Lighthouse ≥ 95",
  used: 9,
  max: 10,
  ringCaption: "of 10",
  ringAriaLabel: "9 of 10",
  budgetLabel: "90 % budget",
  maker: { name: "Coder", role: "Maker" },
  verifier: { name: "Analyst", role: "Verifier" },
  verdict: { head: "Verdict · iteration 9", status: "Waits", text: "LCP blocks" },
};

describe("GoalLoopCard", () => {
  it("renders pair, verdict and actions", () => {
    render(<GoalLoopCard {...base} actions={<button type="button">Go</button>} />);
    expect(screen.getByTestId(GoalLoopCardTestId.Title)).toHaveTextContent("Lighthouse ≥ 95");
    expect(screen.getByTestId(GoalLoopCardTestId.Maker)).toHaveTextContent("Coder");
    expect(screen.getByTestId(GoalLoopCardTestId.Verifier)).toHaveTextContent("Analyst");
    expect(screen.getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent("LCP blocks");
    expect(screen.getByTestId(GoalLoopCardTestId.Budget)).toHaveTextContent("90 % budget");
    expect(screen.getByTestId(GoalLoopCardTestId.Actions)).toHaveTextContent("Go");
  });

  it("opens through the card cover", () => {
    const onOpen = vi.fn();
    render(<GoalLoopCard {...base} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId(GoalLoopCardTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
