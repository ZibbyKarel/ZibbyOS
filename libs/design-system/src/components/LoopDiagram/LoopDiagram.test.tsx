import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { LoopDiagram, LoopDiagramTestId } from "./LoopDiagram";

const base = {
  maker: <button type="button">maker</button>,
  verifier: <button type="button">verifier</button>,
  count: "4 / 8",
  countLabel: "iteration",
  forwardLabel: "result → judge",
  backLabel: "verdict → retry",
};

describe("LoopDiagram", () => {
  it("lays out both nodes, the counter and the arrow captions", () => {
    render(<LoopDiagram {...base} />);
    expect(screen.getByTestId(LoopDiagramTestId.Root)).toHaveRole("group");
    expect(screen.getByTestId(LoopDiagramTestId.Maker)).toHaveTextContent("maker");
    expect(screen.getByTestId(LoopDiagramTestId.Verifier)).toHaveTextContent("verifier");
    expect(screen.getByTestId(LoopDiagramTestId.Count)).toHaveTextContent("4 / 8");
    expect(screen.getByTestId(LoopDiagramTestId.ForwardLabel)).toHaveTextContent("result → judge");
    expect(screen.getByTestId(LoopDiagramTestId.BackLabel)).toHaveTextContent("verdict → retry");
  });

  it("pulses only the active arrow and dashes the back arrow when paused", () => {
    const { rerender } = render(<LoopDiagram {...base} active="forward" />);
    expect(screen.getByTestId(LoopDiagramTestId.ForwardArrow)).toHaveClass("animate-pulse");
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).not.toHaveClass("animate-pulse");
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).not.toHaveAttribute("stroke-dasharray");
    rerender(<LoopDiagram {...base} paused />);
    expect(screen.getByTestId(LoopDiagramTestId.BackArrow)).toHaveAttribute(
      "stroke-dasharray",
      "4 4",
    );
  });
});

import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { LoopDiagramNode, LoopDiagramNodeTestId } from "./LoopDiagram";

describe("LoopDiagramNode", () => {
  it("renders kicker, title, subtitle and line as a static card", () => {
    render(
      <LoopDiagramNode
        kicker="Maker"
        line="Changing auth"
        subtitle="agent · sonnet"
        title="Writer Dev"
      />,
    );
    expect(screen.getByTestId(LoopDiagramNodeTestId.Kicker)).toHaveTextContent("Maker");
    expect(screen.getByTestId(LoopDiagramNodeTestId.Title)).toHaveTextContent("Writer Dev");
    expect(screen.getByTestId(LoopDiagramNodeTestId.Subtitle)).toHaveTextContent("agent · sonnet");
    expect(screen.getByTestId(LoopDiagramNodeTestId.Line)).toHaveTextContent("Changing auth");
    expect(screen.getByTestId(LoopDiagramNodeTestId.Root).tagName).toBe("DIV");
  });

  it("is a named button when clickable", async () => {
    const onClick = vi.fn();
    render(<LoopDiagramNode ariaLabel="Change maker" kicker="Maker" onClick={onClick} title="x" />);
    const node = screen.getByTestId(LoopDiagramNodeTestId.Root);
    expect(node).toHaveRole("button");
    expect(node).toHaveAccessibleName("Change maker");
    await userEvent.click(node);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
