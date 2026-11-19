import { fireEvent, renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import { BrainGraph, BrainGraphTestId } from "./BrainGraph";
import type { BrainGraphData } from "../brainModel";

const graph: BrainGraphData = {
  nodes: [
    { id: "index", localId: "index", sourceId: "index", label: "Index", hub: true },
    { id: "vault:a", localId: "a", sourceId: "vault", label: "A" },
    { id: "vault:b", localId: "b", sourceId: "vault", label: "B", raw: true },
  ],
  edges: [{ from: "vault:a", to: "vault:b" }],
};

const setup = () => {
  const onSelect = vi.fn();
  const onDeselect = vi.fn();
  render(
    <BrainGraph
      graph={graph}
      matchIds={null}
      onDeselect={onDeselect}
      onSelect={onSelect}
      selectedId="vault:a"
      sourceColor={() => "red"}
      sourceName={(id) => id}
    />,
  );
  return { onSelect, onDeselect };
};

describe("BrainGraph deselect", () => {
  it("a click on empty canvas deselects", () => {
    const { onDeselect } = setup();
    fireEvent.click(screen.getByTestId(BrainGraphTestId.Svg));
    expect(onDeselect).toHaveBeenCalledTimes(1);
  });

  it("a click on a node selects it and does not deselect", () => {
    const { onSelect, onDeselect } = setup();
    fireEvent.click(screen.getByTestId(`${BrainGraphTestId.Node}-vault:b`));
    expect(onSelect).toHaveBeenCalledWith("vault:b");
    expect(onDeselect).not.toHaveBeenCalled();
  });

  it("a drag that ends in a click does not deselect", () => {
    const { onDeselect } = setup();
    const svg = screen.getByTestId(BrainGraphTestId.Svg);
    // jsdom has no PointerEvent: dispatch pointer-named mouse events so clientX/Y survive.
    const fire = (type: string, clientX: number) =>
      fireEvent(svg, new MouseEvent(type, { bubbles: true, clientX, clientY: 10 }));
    fire("pointerdown", 10);
    fire("pointermove", 60);
    fire("pointerup", 60);
    fireEvent.click(svg);
    expect(onDeselect).not.toHaveBeenCalled();
  });
});
