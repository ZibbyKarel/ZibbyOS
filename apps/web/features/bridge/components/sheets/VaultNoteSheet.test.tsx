import { cleanup, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../test/render";
import type { SheetAnchor } from "../../state/measure";
import { VaultNoteSheet, VaultNoteSheetTestId } from "./VaultNoteSheet";

const save = vi.hoisted(() => vi.fn());
const setPins = vi.hoisted(() => vi.fn());
const d = vi.hoisted(() => ({
  pins: { paths: [] } as { paths: string[]; labels?: Record<string, string> },
}));
vi.mock("../../../notes/queries", () => ({
  useNoteFileQuery: () => ({ data: { path: "a/x.md", body: "---\ntags: [t]\n---\n# Hello" } }),
  useNotePinsQuery: () => ({ data: d.pins }),
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
    d.pins = { paths: [] };
  });

  it("renders the body without frontmatter and pins the note", () => {
    renderWithProviders(<VaultNoteSheet anchor={anchor} id="a/x.md" onClose={vi.fn()} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByText(/tags/)).toBeNull();
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Pin));
    expect(setPins).toHaveBeenCalledWith({ body: { paths: ["a/x.md"], labels: undefined } });
  });

  it("edit shows the editor over the whole file; cancel returns to reading", () => {
    renderWithProviders(<VaultNoteSheet anchor={anchor} id="a/x.md" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Edit));
    expect(screen.getByTestId(VaultNoteSheetTestId.Save)).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Cancel));
    expect(screen.getByTestId(VaultNoteSheetTestId.Edit)).toBeInTheDocument();
  });

  describe("rename link", () => {
    const ID = "inbox/Idea.md";
    const open = () => {
      d.pins = { paths: ["other.md", ID], labels: { [ID]: "Můj nápad", "other.md": "Jiný" } };
      renderWithProviders(<VaultNoteSheet anchor={anchor} id={ID} onClose={vi.fn()} />);
    };
    const input = () => screen.getByTestId(VaultNoteSheetTestId.LabelInput) as HTMLInputElement;

    it("titles the sheet with the label and keeps the path in the meta", () => {
      open();
      expect(screen.getByText("Můj nápad")).toBeInTheDocument();
      expect(screen.getAllByText(ID).length).toBeGreaterThan(0);
    });

    it("prefills the label, caps it at 120 chars and saves only the pins", () => {
      open();
      fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Rename));
      expect(input().value).toBe("Můj nápad");
      expect(input()).toHaveAttribute("maxlength", "120");
      expect(input()).toHaveAccessibleName("Název odkazu");
      fireEvent.change(input(), { target: { value: "Nový název" } });
      fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.LabelSave));
      expect(setPins).toHaveBeenCalledWith(
        { body: { paths: ["other.md", ID], labels: { [ID]: "Nový název", "other.md": "Jiný" } } },
        expect.anything(),
      );
      expect(save).not.toHaveBeenCalled();
    });

    it("saves an emptied, whitespace or default-name label as no label", () => {
      for (const value of ["", "   ", "Idea"]) {
        setPins.mockClear();
        open();
        fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Rename));
        fireEvent.change(input(), { target: { value } });
        fireEvent.keyDown(input(), { key: "Enter" });
        expect(setPins).toHaveBeenCalledWith(
          { body: { paths: ["other.md", ID], labels: { "other.md": "Jiný" } } },
          expect.anything(),
        );
        cleanup();
      }
    });

    it("Escape cancels without saving", () => {
      open();
      fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Rename));
      fireEvent.keyDown(input(), { key: "Escape" });
      expect(setPins).not.toHaveBeenCalled();
      expect(screen.getByTestId(VaultNoteSheetTestId.Rename)).toBeInTheDocument();
    });

    it("unpin keeps the other labels; no Rename action when not pinned", () => {
      open();
      fireEvent.click(screen.getByTestId(VaultNoteSheetTestId.Pin));
      expect(setPins).toHaveBeenCalledWith({
        body: { paths: ["other.md"], labels: { [ID]: "Můj nápad", "other.md": "Jiný" } },
      });
      cleanup();
      d.pins = { paths: [] };
      renderWithProviders(<VaultNoteSheet anchor={anchor} id={ID} onClose={vi.fn()} />);
      expect(screen.queryByTestId(VaultNoteSheetTestId.Rename)).toBeNull();
    });
  });
});
