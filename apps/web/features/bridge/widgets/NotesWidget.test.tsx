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
  tree: ["INDEX.md", "projects/zibby/plan.md", "projects/zibby/notes.md"] as string[],
}));
vi.mock("../../notes/queries", () => ({
  useNotePinsQuery: () => ({ data: { paths: d.pins }, isPending: false }),
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
    setPins.mockClear();
  });

  it("shows pinned notes as a folder tree and opens a file in the sheet", () => {
    const p = props();
    renderWithProviders(<NotesWidget {...p} />);
    expect(screen.getByTestId(`${TreeViewTestId.Row}-dir:projects`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`${TreeViewTestId.Row}-projects/zibby/plan.md`));
    expect(p.onOpen).toHaveBeenCalledWith({
      kind: "vaultNote",
      id: "projects/zibby/plan.md",
      widgetId: "w-n",
      key: "w-n:projects/zibby/plan.md",
    });
    expect(p.onCountChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 1 }));
  });

  it("browse mode lists the whole vault and a click pins the note", () => {
    renderWithProviders(<NotesWidget {...props({ adding: true })} />);
    fireEvent.click(screen.getByTestId(`${TreeViewTestId.Row}-INDEX.md`));
    expect(setPins).toHaveBeenCalledWith({
      body: { paths: ["projects/zibby/plan.md", "INDEX.md"] },
    });
  });

  it("shows a hint when nothing is pinned", () => {
    d.pins = [];
    renderWithProviders(<NotesWidget {...props()} />);
    expect(screen.getByTestId(NotesWidgetTestId.Empty)).toBeInTheDocument();
  });
});
