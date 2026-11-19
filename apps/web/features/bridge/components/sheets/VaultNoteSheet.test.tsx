import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../test/render";
import type { SheetAnchor } from "../../state/measure";
import { VaultNoteSheet, VaultNoteSheetTestId } from "./VaultNoteSheet";

const save = vi.hoisted(() => vi.fn());
const setPins = vi.hoisted(() => vi.fn());
vi.mock("../../../notes/queries", () => ({
  useNoteFileQuery: () => ({ data: { path: "a/x.md", body: "---\ntags: [t]\n---\n# Hello" } }),
  useNotePinsQuery: () => ({ data: { paths: [] } }),
}));
vi.mock("../../../notes/mutations", () => ({
  useSaveNoteMutation: () => ({ mutate: save, isPending: false, isError: false }),
  useSetNotePinsMutation: () => ({ mutate: setPins, isPending: false }),
}));

const anchor: SheetAnchor = {
  side: "r",
  left: 0,
  width: 600,
  top: 0,
  height: 500,
  eL: 0,
  eT: 0,
  eH: 0,
};

describe("VaultNoteSheet", () => {
  beforeEach(() => {
    save.mockClear();
    setPins.mockClear();
  });

  it("renders the body without frontmatter and pins the note", () => {
    renderWithProviders(<VaultNoteSheet anchor={anchor} id="a/x.md" onClose={vi.fn()} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByText(/tags/)).toBeNull();
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Pin));
    expect(setPins).toHaveBeenCalledWith({ body: { paths: ["a/x.md"] } });
  });

  it("edit shows the editor over the whole file; cancel returns to reading", () => {
    renderWithProviders(<VaultNoteSheet anchor={anchor} id="a/x.md" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Edit));
    expect(screen.getByTestId(VaultNoteSheetTestId.Save)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Cancel));
    expect(screen.getByTestId(VaultNoteSheetTestId.Edit)).toBeInTheDocument();
  });
});
