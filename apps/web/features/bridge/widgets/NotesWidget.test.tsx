import { TreeViewTestId } from "@zibby/design-system";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../test/render";
import type { BridgeWidget } from "../grid/layout";
import { NotesWidget, NotesWidgetTestId } from "./NotesWidget";
import type { BridgeWidgetProps } from "./registry";

const setPins = vi.hoisted(() => vi.fn());
const d = vi.hoisted(() => ({
  pins: ["projects/zibby/plan.md"] as string[],
  labels: undefined as Record<string, string> | undefined,
  tree: ["INDEX.md", "projects/zibby/plan.md", "projects/zibby/notes.md"] as string[],
}));
vi.mock("../../notes/queries", () => ({
  useNotePinsQuery: () => ({ data: { paths: d.pins, labels: d.labels }, isPending: false }),
  useNoteTreeQuery: () => ({ data: { paths: d.tree } }),
}));
vi.mock("../../notes/mutations", () => ({
  useSetNotePinsMutation: () => ({ mutate: setPins }),
}));

const widget: BridgeWidget = { id: "w-n", type: "notes", x: 0, y: 0, w: 4, h: 8 };
const props = (over: Partial<BridgeWidgetProps> = {}): BridgeWidgetProps => ({
  widget,
  adding: false,
  onEmptyChange: vi.fn(),
  onCountChange: vi.fn(),
  selection: null,
  onOpen: vi.fn(),
  epicClosed: {},
  onEpicToggle: vi.fn(),
  ...over,
});

describe("NotesWidget", () => {
  beforeEach(() => {
    d.pins = ["projects/zibby/plan.md"];
    d.labels = undefined;
    setPins.mockClear();
  });

  it("shows pinned notes as flat icon + name rows, honours labels and opens the note", () => {
    d.pins = ["projects/x/Plan.md", "inbox/Idea.md"];
    d.labels = { "inbox/Idea.md": "Můj nápad" };
    const p = props();
    renderWithProviders(<NotesWidget {...p} />);
    const rows = screen.getAllByTestId(new RegExp(`^${TreeViewTestId.Row}-`));
    expect(rows.map((r) => r.textContent)).toEqual(["Plan", "Můj nápad"]);
    expect(screen.queryByTestId(`${TreeViewTestId.Row}-dir:projects`)).toBeNull();
    for (const r of rows) expect(r.querySelector("svg")).not.toBeNull();
    fireEvent.click(screen.getByTestId(`${TreeViewTestId.Row}-projects/x/Plan.md`));
    expect(p.onOpen).toHaveBeenCalledWith({
      kind: "vaultNote",
      id: "projects/x/Plan.md",
      widgetId: "w-n",
      key: "w-n:projects/x/Plan.md",
    });
    expect(p.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2 }));
  });

  it("browse mode lists the whole vault and a click pins the note", () => {
    renderWithProviders(<NotesWidget {...props({ adding: true })} />);
    fireEvent.click(screen.getByTestId(`${TreeViewTestId.Row}-INDEX.md`));
    expect(setPins).toHaveBeenCalledWith({
      body: { paths: ["projects/zibby/plan.md", "INDEX.md"], labels: undefined },
    });
  });

  it("browse mode pin toggle preserves the other labels", () => {
    d.labels = { "projects/zibby/plan.md": "Plán" };
    renderWithProviders(<NotesWidget {...props({ adding: true })} />);
    fireEvent.click(screen.getByTestId(`${TreeViewTestId.Row}-INDEX.md`));
    expect(setPins).toHaveBeenCalledWith({
      body: {
        paths: ["projects/zibby/plan.md", "INDEX.md"],
        labels: { "projects/zibby/plan.md": "Plán" },
      },
    });
  });

  it("shows a hint when nothing is pinned", () => {
    d.pins = [];
    renderWithProviders(<NotesWidget {...props()} />);
    expect(screen.getByTestId(NotesWidgetTestId.Empty)).toBeInTheDocument();
  });
});
