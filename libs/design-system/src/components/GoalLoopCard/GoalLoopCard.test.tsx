import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedRingTestId } from "../SegmentedRing/SegmentedRing";
import { GoalLoopCard, GoalLoopCardTestId } from "./GoalLoopCard";

const base = {
  state: "blocked" as const,
  stateLabel: "Parked",
  title: "Lighthouse ≥ 95",
  used: 9,
  max: 10,
  ringCaption: "of 10",
  ringAriaLabel: "9 of 10",
};

const parties = [
  { name: "Coder", role: "Maker" },
  { name: "Analyst", role: "Verifier" },
];

describe("GoalLoopCard", () => {
  it("renders the parties with their separator, the verdict, top meta and actions", () => {
    render(
      <GoalLoopCard
        {...base}
        actions={<button type="button">Go</button>}
        parties={parties}
        partySeparator="⇄"
        topMeta="90 % budget"
        verdict={{ head: "Verdict · iteration 9", status: "Waits", text: "LCP blocks" }}
      />,
    );
    expect(screen.getByTestId(GoalLoopCardTestId.Title)).toHaveTextContent("Lighthouse ≥ 95");
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-0`)).toHaveTextContent("MakerCoder");
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-1`)).toHaveTextContent(
      "VerifierAnalyst",
    );
    expect(screen.getByTestId(GoalLoopCardTestId.PartySeparator)).toHaveTextContent("⇄");
    expect(screen.getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent("LCP blocks");
    expect(screen.getByTestId(GoalLoopCardTestId.TopMeta)).toHaveTextContent("90 % budget");
    expect(screen.getByTestId(GoalLoopCardTestId.Actions)).toHaveTextContent("Go");
  });

  it("omits the separator, avatars, top meta, verdict and pair row when not given", () => {
    const { rerender } = render(
      <GoalLoopCard
        {...base}
        parties={[{ name: "Bez projektu", role: "Rozsah", avatar: false }]}
      />,
    );
    expect(screen.getByTestId(`${GoalLoopCardTestId.Party}-0`)).toHaveTextContent(
      "RozsahBez projektu",
    );
    expect(screen.queryByTestId(GoalLoopCardTestId.PartySeparator)).not.toBeInTheDocument();
    expect(screen.queryByTestId(GoalLoopCardTestId.TopMeta)).not.toBeInTheDocument();
    expect(screen.queryByTestId(GoalLoopCardTestId.Verdict)).not.toBeInTheDocument();
    rerender(<GoalLoopCard {...base} />);
    expect(screen.queryByTestId(GoalLoopCardTestId.Parties)).not.toBeInTheDocument();
  });

  it("marks the selected card", () => {
    const { rerender } = render(<GoalLoopCard {...base} />);
    expect(screen.getByTestId(GoalLoopCardTestId.Root)).toHaveAttribute("data-selected", "false");
    rerender(<GoalLoopCard {...base} selected />);
    expect(screen.getByTestId(GoalLoopCardTestId.Root)).toHaveAttribute("data-selected", "true");
  });

  it("shows a ring value override", () => {
    render(<GoalLoopCard {...base} ringValue="–" />);
    expect(screen.getByTestId(SegmentedRingTestId.Used)).toHaveTextContent("–");
  });

  it("compact keeps pill, title and a one-line verdict text, drops parties, meta and actions", () => {
    render(
      <GoalLoopCard
        {...base}
        actions={<button type="button">Go</button>}
        parties={parties}
        size="compact"
        topMeta="daily"
        verdict={{ head: "Last step", text: "Opened PR #4" }}
      />,
    );
    expect(screen.getByTestId(GoalLoopCardTestId.Root)).toHaveAttribute("data-size", "compact");
    expect(screen.getByTestId(GoalLoopCardTestId.State)).toHaveTextContent("Parked");
    expect(screen.getByTestId(GoalLoopCardTestId.Title)).toHaveTextContent("Lighthouse ≥ 95");
    expect(screen.getByTestId(GoalLoopCardTestId.Verdict)).toHaveTextContent(/^Opened PR #4$/);
    expect(screen.getByTestId(SegmentedRingTestId.Root)).toHaveStyle({ width: "56px" });
    expect(screen.queryByTestId(GoalLoopCardTestId.Parties)).not.toBeInTheDocument();
    expect(screen.queryByTestId(GoalLoopCardTestId.TopMeta)).not.toBeInTheDocument();
    expect(screen.queryByTestId(GoalLoopCardTestId.Actions)).not.toBeInTheDocument();
  });

  it("opens through the card cover", () => {
    const onOpen = vi.fn();
    render(<GoalLoopCard {...base} onOpen={onOpen} openLabel="Open: Lighthouse" />);
    const cover = screen.getByTestId(GoalLoopCardTestId.Open);
    expect(cover).toHaveAccessibleName("Open: Lighthouse");
    fireEvent.click(cover);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows the current segment of a working goal even before anything is done", () => {
    render(<GoalLoopCard {...base} max={3} state="working" used={0} />);
    const segs = screen.getAllByTestId(SegmentedRingTestId.Segment);
    expect(segs.map((seg) => seg.getAttribute("data-current"))).toEqual(["true", "false", "false"]);
  });
});
