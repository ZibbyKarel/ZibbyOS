import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import {
  IterationTimeline,
  IterationTimelineItem,
  IterationTimelineTestId,
} from "./IterationTimeline";

const rows = [
  { label: "Maker", icon: "check" as const, tone: "ok" as const, text: "Added tests" },
  { label: "Verifier", icon: "x" as const, tone: "bad" as const, text: "Missing expiry" },
];

describe("IterationTimeline", () => {
  it("renders a named list with marker, title, meta and labelled rows", () => {
    render(
      <IterationTimeline ariaLabel="Iterations">
        <IterationTimelineItem
          marker={3}
          meta="2m · $0.3"
          rows={rows}
          title="Iteration 3"
          tone="bad"
        />
      </IterationTimeline>,
    );
    expect(screen.getByTestId(IterationTimelineTestId.Root)).toHaveAccessibleName("Iterations");
    expect(screen.getByTestId(IterationTimelineTestId.Marker)).toHaveTextContent("3");
    expect(screen.getByTestId(IterationTimelineTestId.Title)).toHaveTextContent("Iteration 3");
    expect(screen.getByTestId(IterationTimelineTestId.Meta)).toHaveTextContent("2m · $0.3");
    expect(screen.getAllByTestId(IterationTimelineTestId.Row)).toHaveLength(2);
    expect(screen.queryByTestId(IterationTimelineTestId.Toggle)).toBeNull();
  });

  it("shows the body only while expanded and fires the toggle", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <IterationTimeline ariaLabel="x">
        <IterationTimelineItem
          marker={1}
          onToggle={onToggle}
          rows={rows}
          title="t"
          toggleLabel="Show log"
        >
          the log
        </IterationTimelineItem>
      </IterationTimeline>,
    );
    expect(screen.queryByTestId(IterationTimelineTestId.Body)).toBeNull();
    await userEvent.click(screen.getByTestId(IterationTimelineTestId.Toggle));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByTestId(IterationTimelineTestId.Toggle)).toHaveAccessibleName("Show log");
    rerender(
      <IterationTimeline ariaLabel="x">
        <IterationTimelineItem expanded marker={1} onToggle={onToggle} rows={rows} title="t">
          the log
        </IterationTimelineItem>
      </IterationTimeline>,
    );
    expect(screen.getByTestId(IterationTimelineTestId.Body)).toHaveTextContent("the log");
    expect(screen.getByTestId(IterationTimelineTestId.Toggle)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
