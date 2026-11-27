import { renderWithProviders as render, screen } from "../../../../test/render";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ForkColumn, ForkColumnTestId } from "./ForkColumn";
import { placeChain } from "./canvasLayout";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const node: GraphNode = {
  id: "publish",
  type: "parallel",
  agent: "",
  produces: "joined.md",
  commands: "",
  model: "sonnet",
  thinking: "medium",
  x: 0,
  y: 0,
  branches: [
    { id: "kdp", workflow: "kdp-publish" },
    { id: "mw", workflow: "mw-publish" },
    { id: "etsy", workflow: "etsy-publish" },
  ],
};

describe("ForkColumn", () => {
  const p = placeChain([node], false);
  const view = (onSelect = vi.fn()) => {
    render(
      <ForkColumn
        branches={p.branches.get("publish")!}
        column={p.cards.get("publish")!}
        node={node}
        onSelect={onSelect}
        problem={false}
        selected={false}
      />,
    );
    return onSelect;
  };

  it("draws one card per branch with its id and child workflow", () => {
    view();
    expect(screen.getAllByTestId(/^fork-branch-publish-/)).toHaveLength(3);
    expect(screen.getByTestId("fork-branch-publish-mw")).toHaveTextContent("mw-publish");
  });

  it("opens the child workflow on a branch click", async () => {
    view();
    await userEvent.click(screen.getByTestId("fork-branch-publish-etsy"));
    expect(push).toHaveBeenCalledWith("/work/workflows/etsy-publish");
  });

  it("selects the phase from the badge, which shows the branch count", async () => {
    const onSelect = view();
    const badge = screen.getByTestId(ForkColumnTestId.Badge);
    expect(badge).toHaveTextContent("×3");
    await userEvent.click(badge);
    expect(onSelect).toHaveBeenCalledWith("publish");
  });
});
