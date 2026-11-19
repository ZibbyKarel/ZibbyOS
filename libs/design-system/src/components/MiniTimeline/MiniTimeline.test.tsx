import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniTimeline, MiniTimelineTestId } from "./MiniTimeline";

describe("MiniTimeline", () => {
  it("renders last / now / next with labels", () => {
    render(
      <MiniTimeline last next leftLabel="před 9 h" now={40} nowLabel="teď" rightLabel="za 15 h" />,
    );
    expect(screen.getByTestId(MiniTimelineTestId.Now)).toHaveStyle({ left: "40%" });
    expect(screen.getByTestId(MiniTimelineTestId.Last)).toBeInTheDocument();
    expect(screen.getByTestId(MiniTimelineTestId.Next)).toBeInTheDocument();
    expect(screen.getByTestId(MiniTimelineTestId.LabelRight)).toHaveTextContent("za 15 h");
  });
  it("renders fire dots without a now tick", () => {
    render(<MiniTimeline fires={[10, 50, 90]} />);
    expect(screen.getAllByTestId(MiniTimelineTestId.Fire)).toHaveLength(3);
    expect(screen.queryByTestId(MiniTimelineTestId.Now)).toBeNull();
  });
  it("clamps out-of-range positions", () => {
    render(<MiniTimeline now={140} />);
    expect(screen.getByTestId(MiniTimelineTestId.Now)).toHaveStyle({ left: "100%" });
  });
});
