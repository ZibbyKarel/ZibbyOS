import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowTilePair, FlowTilePairTestId } from "./FlowTilePair";

const trigger = { icon: <i />, kicker: "KDY", title: "Každý den v 8:00", code: "0 8 * * *" };
const target = { icon: <i />, kicker: "AGENT", title: "Dispečer" };

describe("FlowTilePair", () => {
  it("renders both tiles", () => {
    render(<FlowTilePair target={target} trigger={trigger} />);
    expect(screen.getByTestId(FlowTilePairTestId.Trigger)).toHaveTextContent("0 8 * * *");
    expect(screen.getByTestId(FlowTilePairTestId.Target)).toHaveTextContent("Dispečer");
    expect(screen.getByTestId(FlowTilePairTestId.Root)).not.toHaveAttribute("data-off");
  });
  it("marks an off automation", () => {
    render(<FlowTilePair off target={target} trigger={trigger} />);
    expect(screen.getByTestId(FlowTilePairTestId.Root)).toHaveAttribute("data-off", "true");
  });
});
