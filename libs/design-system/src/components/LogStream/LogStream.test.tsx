import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LogStream, LogStreamTestId } from "./LogStream";
import type { LogStreamLine } from "./LogStream";

const LINES: LogStreamLine[] = [
  { id: "l1", ts: "14:02:01", source: "DEV", text: "Kodér opened a branch." },
  { id: "l2", ts: "14:02:07", source: "DEV", state: "working", text: "Running tests…" },
];

describe("LogStream", () => {
  it("renders one line per entry", () => {
    render(<LogStream lines={LINES} />);
    expect(screen.getByTestId(`${LogStreamTestId.Line}-l1`)).toHaveTextContent(
      "Kodér opened a branch.",
    );
    expect(screen.getByTestId(`${LogStreamTestId.Line}-l2`)).toHaveTextContent("Running tests…");
  });

  it("shows a blinking caret only on the newest line", () => {
    render(<LogStream lines={LINES} />);
    expect(screen.getByTestId(LogStreamTestId.Caret)).toBeInTheDocument();
    expect(
      screen
        .getByTestId(`${LogStreamTestId.Line}-l1`)
        .querySelector('[data-testid="log-stream-caret"]'),
    ).not.toBeInTheDocument();
  });

  it("freezes the caret animation when paused", () => {
    render(<LogStream paused lines={LINES} />);
    expect(screen.getByTestId(LogStreamTestId.Caret)).toHaveStyle({ animation: "none" });
  });

  it("caps rendered lines to max, keeping the most recent", () => {
    render(<LogStream lines={LINES} max={1} />);
    expect(screen.queryByTestId(`${LogStreamTestId.Line}-l1`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`${LogStreamTestId.Line}-l2`)).toBeInTheDocument();
  });

  it("renders an empty message when there are no lines", () => {
    render(<LogStream lines={[]} />);
    expect(screen.getByTestId(LogStreamTestId.Empty)).toBeInTheDocument();
  });

  it("renders an alert line with the error surface", () => {
    render(<LogStream lines={[{ id: "e1", ts: "1", text: "boom", alert: true }]} />);
    expect(screen.getByTestId(`${LogStreamTestId.Line}-e1`)).toHaveClass("bg-bad-solid");
  });

  it("makes alert lines buttons that report their id when onLineClick is set", () => {
    const onLineClick = vi.fn();
    const lines = LINES.map((l) => (l.id === "l1" ? { ...l, alert: true } : l));
    render(<LogStream lines={lines} onLineClick={onLineClick} />);
    const line = screen.getByTestId(`${LogStreamTestId.Line}-l1`);
    expect(line).toHaveRole("button");
    expect(line).toHaveAccessibleName(/Kodér opened a branch\./);
    fireEvent.click(line);
    expect(onLineClick).toHaveBeenCalledWith("l1");
    expect(screen.getByTestId(`${LogStreamTestId.Line}-l2`)).not.toHaveRole("button");
  });

  it("scrolls the focusId line into view once, not on new lines", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { rerender } = render(<LogStream focusId="l1" lines={LINES} />);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(`${LogStreamTestId.Line}-l1`)).toHaveClass("outline");
    rerender(<LogStream focusId="l1" lines={[...LINES, { id: "l3", ts: "3", text: "new" }]} />);
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
