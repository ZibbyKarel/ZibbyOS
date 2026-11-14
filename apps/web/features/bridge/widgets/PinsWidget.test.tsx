import { LauncherTileTestId } from "@zibby/design-system";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import { PinsWidget } from "./PinsWidget";
import type { BridgeWidgetProps } from "./registry";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../pins", () => ({
  usePinsQuery: () => ({
    data: [
      { kind: "page", id: "/dashboard/inbox/pull-requests", label: "Pull Requests" },
      { kind: "workflow", id: "coloring-book-random" },
      { kind: "agent", id: "gone-agent" },
    ],
    isPending: false,
  }),
}));
vi.mock("../../workflows", () => ({
  useWorkflowsQuery: () => ({ data: [{ id: "coloring-book-random", name: "Coloring book" }] }),
}));
vi.mock("../../agents/queries", () => ({ useAgentsQuery: () => ({ data: [] }) }));

const widget: BridgeWidget = { id: "w-p", type: "pins", x: 0, y: 0, w: 4, h: 8 };
const onCountChange = vi.fn();
const props: BridgeWidgetProps = {
  widget,
  adding: false,
  onEmptyChange: vi.fn(),
  onCountChange,
  selection: null,
  onOpen: vi.fn(),
  epicClosed: {},
  onEpicToggle: vi.fn(),
};

describe("PinsWidget", () => {
  it("lists page, workflow and agent pins in pin order as launcher tiles, the kind in the tooltip", () => {
    renderWithProviders(<PinsWidget {...props} />);
    const rows = screen.getAllByTestId(LauncherTileTestId.Root);
    expect(rows.map((r) => r.textContent)).toEqual([
      "Pull Requests",
      "Coloring book",
      "gone-agent",
    ]);
    expect(rows.map((r) => r.getAttribute("title"))).toEqual([
      "Pull Requests · Stránka",
      "Coloring book · Workflow",
      "gone-agent · Agent",
    ]);
    expect(onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 3 }));
  });

  it("navigates to the page, the workflow detail and the agent detail", () => {
    renderWithProviders(<PinsWidget {...props} />);
    const rows = screen.getAllByTestId(LauncherTileTestId.Root);
    rows.forEach((r) => fireEvent.click(r));
    expect(push.mock.calls.map((c) => c[0])).toEqual([
      "/dashboard/inbox/pull-requests",
      "/work/workflows/coloring-book-random",
      "/workforce/agents/gone-agent",
    ]);
  });
});
