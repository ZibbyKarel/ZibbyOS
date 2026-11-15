import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { AnchoredSheet, AnchoredSheetTestId } from "./AnchoredSheet";
import { SheetPresentationContext } from "./sheetPresentation";
import { SheetAction, SheetBanner, SheetBlock, SheetPartsTestId, SheetText } from "./SheetParts";

const geo = {
  left: 100,
  width: 500,
  top: 0,
  height: 700,
  eraserLeft: -2,
  eraserTop: 40,
  eraserHeight: 30,
};

describe("AnchoredSheet", () => {
  it("renders header parts, chips, body and footer", () => {
    render(
      <AnchoredSheet
        actions={<SheetAction intent="primary">GO</SheetAction>}
        chips={["A", "B"]}
        closeLabel="Close"
        footerNote="NOTE"
        hint="J / K · ESC"
        kind="PULL REQUEST · #1"
        onClose={() => {}}
        stateLabel="CI FAILING"
        title="Fix it"
        tone="error"
        {...geo}
      >
        <SheetBlock label="DESCRIPTION">
          <SheetText lines={["one", "two"]} />
        </SheetBlock>
      </AnchoredSheet>,
    );
    expect(screen.getByTestId(AnchoredSheetTestId.Kind)).toHaveTextContent("PULL REQUEST · #1");
    expect(screen.getByTestId(AnchoredSheetTestId.State)).toHaveTextContent("CI FAILING");
    expect(screen.getByTestId(AnchoredSheetTestId.Hint)).toHaveTextContent("J / K · ESC");
    expect(screen.getByTestId(AnchoredSheetTestId.Title)).toHaveTextContent("Fix it");
    expect(screen.getAllByTestId(AnchoredSheetTestId.Chip)).toHaveLength(2);
    expect(screen.getAllByTestId(SheetPartsTestId.Text)).toHaveLength(2);
    expect(screen.getByTestId(AnchoredSheetTestId.FooterNote)).toHaveTextContent("NOTE");
    expect(screen.getByTestId(AnchoredSheetTestId.Actions)).toHaveTextContent("GO");
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveRole("dialog");
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveAccessibleName("Fix it");
    // The tone now colours the state pill (no tone top border).
    expect(screen.getByTestId(AnchoredSheetTestId.State)).toHaveAttribute("data-tone", "error");
  });

  it("shows max 2 state pills, most severe first; a loud one is marked", () => {
    render(
      <AnchoredSheet
        closeLabel="x"
        kind="k"
        onClose={() => {}}
        title="t"
        tones={[
          { tone: "idle", label: "Draft" },
          { tone: "blocked", label: "Your review", loud: true },
          { tone: "error", label: "CI failing" },
        ]}
        {...geo}
      />,
    );
    const pills = screen.getAllByTestId(AnchoredSheetTestId.State);
    expect(pills.map((p) => p.textContent)).toEqual(["CI failing", "Your review"]);
    expect(pills[1]).toHaveAttribute("data-loud", "true");
  });

  it("row 1: glyph, copyable id (copied label), back, step counter, expand", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onBack = vi.fn();
    const onStep = vi.fn();
    const onToggleExpand = vi.fn();
    render(
      <AnchoredSheet
        expandable
        backAriaLabel="Back to #1"
        backLabel="#1"
        closeLabel="x"
        copiedLabel="Copied!"
        copyId="#12"
        copyLabel="Copy id"
        expandLabel="Expand"
        glyph="branch"
        kind="Pull request"
        onBack={onBack}
        onClose={() => {}}
        onStep={onStep}
        onToggleExpand={onToggleExpand}
        stepNextLabel="Next"
        stepPosition={{ index: 0, total: 8 }}
        stepPrevLabel="Previous"
        title="t"
        {...geo}
      />,
    );
    expect(screen.getByTestId(AnchoredSheetTestId.Glyph)).toBeInTheDocument();
    const copy = screen.getByTestId(AnchoredSheetTestId.CopyId);
    expect(copy).toHaveAccessibleName("Copy id #12");
    await userEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith("#12");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Back));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByTestId(AnchoredSheetTestId.Back)).toHaveAccessibleName("Back to #1");
    expect(screen.getByTestId(AnchoredSheetTestId.StepPosition)).toHaveTextContent("1 / 8");
    expect(screen.getByTestId(AnchoredSheetTestId.StepPrev)).toBeDisabled();
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.StepNext));
    expect(onStep).toHaveBeenCalledWith(1);
    const expand = screen.getByTestId(AnchoredSheetTestId.Expand);
    expect(expand).toHaveAccessibleName("Expand");
    await userEvent.click(expand);
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });

  it("no back / step / expand without their handlers; banner and composer slots", () => {
    render(
      <AnchoredSheet
        banner={<SheetBanner icon="warn" title="CI failing" tone="error" />}
        closeLabel="x"
        composer={<textarea />}
        kind="k"
        onClose={() => {}}
        title="t"
        {...geo}
      />,
    );
    expect(screen.queryByTestId(AnchoredSheetTestId.Back)).toBeNull();
    expect(screen.queryByTestId(AnchoredSheetTestId.StepNext)).toBeNull();
    expect(screen.queryByTestId(AnchoredSheetTestId.Expand)).toBeNull();
    expect(screen.getByTestId(AnchoredSheetTestId.Banner)).toContainElement(
      screen.getByTestId(SheetPartsTestId.Banner),
    );
    expect(screen.getByTestId(SheetPartsTestId.Banner)).toHaveRole("alert");
    expect(screen.getByTestId(AnchoredSheetTestId.Composer)).toBeInTheDocument();
  });

  it("applies geometry and the eraser strip", () => {
    render(<AnchoredSheet closeLabel="x" kind="k" onClose={() => {}} title="t" {...geo} />);
    const root = screen.getByTestId(AnchoredSheetTestId.Root);
    expect(root).toHaveStyle({ left: "100px", top: "0px", width: "500px", height: "700px" });
    expect(screen.getByTestId(AnchoredSheetTestId.Eraser)).toHaveStyle({
      left: "-2px",
      top: "40px",
      height: "30px",
    });
    expect(screen.queryByTestId(AnchoredSheetTestId.Footer)).toBeNull();
  });

  it("renders the title as an external link when titleHref is set", () => {
    render(
      <AnchoredSheet
        closeLabel="x"
        kind="k"
        onClose={() => {}}
        title="T"
        titleHref="https://x.test/1"
        {...geo}
      />,
    );
    const link = screen.getByTestId(AnchoredSheetTestId.TitleLink);
    expect(link).toHaveAttribute("href", "https://x.test/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName("T");
  });

  it("renders actions in the header", () => {
    render(
      <AnchoredSheet
        actions={<button type="button">Go</button>}
        closeLabel="x"
        kind="k"
        onClose={() => {}}
        title="t"
        {...geo}
      />,
    );
    const actions = screen.getByTestId(AnchoredSheetTestId.Actions);
    expect(screen.getByTestId(AnchoredSheetTestId.Header)).toContainElement(actions);
    expect(actions).toHaveTextContent("Go");
  });

  it("renders the meta line in the header only when given", () => {
    const { unmount } = render(
      <AnchoredSheet
        closeLabel="x"
        kind="k"
        meta={<span>feat → main</span>}
        onClose={() => {}}
        title="t"
        {...geo}
      />,
    );
    const meta = screen.getByTestId(AnchoredSheetTestId.Meta);
    expect(screen.getByTestId(AnchoredSheetTestId.Header)).toContainElement(meta);
    expect(meta).toHaveTextContent("feat → main");
    unmount();
    render(<AnchoredSheet closeLabel="x" kind="k" onClose={() => {}} title="t" {...geo} />);
    expect(screen.queryByTestId(AnchoredSheetTestId.Meta)).toBeNull();
  });

  it("no actions container without actions", () => {
    render(<AnchoredSheet closeLabel="x" kind="k" onClose={() => {}} title="t" {...geo} />);
    expect(screen.queryByTestId(AnchoredSheetTestId.Actions)).toBeNull();
    expect(screen.queryByTestId(AnchoredSheetTestId.TitleLink)).toBeNull();
  });

  it("closes from the overlay and the × button", async () => {
    const onClose = vi.fn();
    render(<AnchoredSheet closeLabel="Close" kind="k" onClose={onClose} title="t" {...geo} />);
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Overlay));
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Close));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(AnchoredSheetTestId.Close)).toHaveAccessibleName("Close");
  });
  it("renders the trail as the header's last row only when given", () => {
    const { rerender } = render(
      <AnchoredSheet
        closeLabel="Close"
        kind="K"
        meta={<span>m</span>}
        onClose={() => {}}
        title="T"
        trail={<span>STACK</span>}
        {...geo}
      />,
    );
    const trail = screen.getByTestId(AnchoredSheetTestId.Trail);
    expect(screen.getByTestId(AnchoredSheetTestId.Header).lastElementChild).toBe(trail);
    expect(trail).toHaveTextContent("STACK");
    rerender(
      <AnchoredSheet
        closeLabel="Close"
        kind="K"
        meta={<span>m</span>}
        onClose={() => {}}
        title="T"
        {...geo}
      />,
    );
    expect(screen.queryByTestId(AnchoredSheetTestId.Trail)).toBeNull();
  });
});

describe("AnchoredSheet anchored moreActions", () => {
  it("renders actions then moreActions in the one header group", () => {
    render(
      <AnchoredSheet
        actions={<button type="button">GO</button>}
        closeLabel="Close"
        kind="PR"
        moreActions={<button type="button">MORE</button>}
        onClose={() => {}}
        presentation="anchored"
        title="Fix it"
        {...geo}
      />,
    );
    expect(screen.getByTestId(AnchoredSheetTestId.Actions)).toHaveTextContent("GOMORE");
  });
});

describe("AnchoredSheet page presentation", () => {
  const page = (extra = {}) =>
    render(
      <AnchoredSheet
        expandable
        actions={<SheetAction intent="primary">GO</SheetAction>}
        closeLabel="Close"
        footerNote="NOTE"
        kind="PR"
        onClose={() => {}}
        onStep={() => {}}
        presentation="page"
        title="Fix it"
        {...geo}
        {...extra}
      >
        body
      </AnchoredSheet>,
    );

  it("is a modal full page: no overlay, no geometry, actions in the bottom bar, no stepping", () => {
    page();
    const root = screen.getByTestId(AnchoredSheetTestId.Root);
    expect(root).toHaveAttribute("aria-modal", "true");
    expect(root).toHaveAttribute("data-presentation", "page");
    expect(root.style.width).toBe("");
    expect(screen.queryByTestId(AnchoredSheetTestId.Overlay)).toBeNull();
    expect(screen.queryByTestId(AnchoredSheetTestId.Expand)).toBeNull();
    expect(screen.queryByTestId(AnchoredSheetTestId.StepNext)).toBeNull();
    expect(screen.getByTestId(AnchoredSheetTestId.ActionBar)).toHaveTextContent("GO");
    expect(screen.queryByTestId(AnchoredSheetTestId.Actions)).toBeNull();
    expect(screen.getByTestId(AnchoredSheetTestId.Footer)).toHaveTextContent("NOTE");
  });

  it("keeps moreActions in the header while only actions fill the bottom bar", () => {
    page({ moreActions: <button type="button">MORE</button> });
    expect(screen.getByTestId(AnchoredSheetTestId.ActionBar)).not.toHaveTextContent("MORE");
    const header = screen.getByTestId(AnchoredSheetTestId.Actions);
    expect(header).toHaveTextContent("MORE");
    expect(header).not.toHaveTextContent("GO");
  });

  it("has one close button (back to the board) and closes", async () => {
    const onClose = vi.fn();
    page({ onClose });
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("with a back stack keeps back and close as separate buttons", async () => {
    const onBack = vi.fn();
    page({ onBack, backLabel: "#1" });
    await userEvent.click(screen.getByTestId(AnchoredSheetTestId.Back));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId(AnchoredSheetTestId.Close)).toHaveLength(1);
  });

  it("locks body scroll, focuses the page and restores both on unmount", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = page();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveFocus();
    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("traps Tab inside the page", async () => {
    page();
    const close = screen.getByTestId(AnchoredSheetTestId.Close);
    const action = screen.getByTestId(SheetPartsTestId.Action);
    action.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(action).toHaveFocus();
  });

  it("takes the presentation from context when the prop is absent", () => {
    render(
      <SheetPresentationContext value="page">
        <AnchoredSheet closeLabel="x" kind="k" onClose={() => {}} title="t" {...geo} />
      </SheetPresentationContext>,
    );
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveAttribute(
      "data-presentation",
      "page",
    );
  });
});

describe("SheetAction", () => {
  it("is a link when it has an href, a button otherwise", () => {
    const { rerender } = render(<SheetAction href="https://x.test">GH</SheetAction>);
    expect(screen.getByTestId(SheetPartsTestId.Action)).toHaveAttribute("href", "https://x.test");
    rerender(<SheetAction>BTN</SheetAction>);
    expect(screen.getByTestId(SheetPartsTestId.Action).tagName).toBe("BUTTON");
  });

  it("ignores clicks when disabled", async () => {
    const onClick = vi.fn();
    render(
      <SheetAction disabled onClick={onClick}>
        MERGE
      </SheetAction>,
    );
    const el = screen.getByTestId(SheetPartsTestId.Action);
    expect(el).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  describe("resize handle", () => {
    // jsdom has no PointerEvent; MouseEvent carries the clientX the handler reads.
    beforeEach(() => void vi.stubGlobal("PointerEvent", MouseEvent));
    afterEach(() => void vi.unstubAllGlobals());
    const base = { closeLabel: "Close", kind: "PR", onClose: () => {}, title: "t", ...geo };

    it("is absent without onResize and on a page", () => {
      const { rerender } = render(<AnchoredSheet {...base} />);
      expect(screen.queryByTestId(AnchoredSheetTestId.ResizeHandle)).toBeNull();
      rerender(<AnchoredSheet {...base} onResize={() => {}} presentation="page" />);
      expect(screen.queryByTestId(AnchoredSheetTestId.ResizeHandle)).toBeNull();
    });

    it("is a labelled vertical separator on the chosen edge", () => {
      render(
        <AnchoredSheet {...base} onResize={() => {}} resizeEdge="left" resizeLabel="Změnit" />,
      );
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      expect(h).toHaveRole("separator");
      expect(h).toHaveAttribute("aria-orientation", "vertical");
      expect(h).toHaveAccessibleName("Změnit");
      expect(h.className).toContain("left-0");
    });

    it("drags a right edge wider by dx and reports the last width on release", () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      render(<AnchoredSheet {...base} onResize={onResize} onResizeEnd={onResizeEnd} />);
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      fireEvent.pointerDown(h, { clientX: 600, pointerId: 1 });
      fireEvent.pointerMove(h, { clientX: 650, pointerId: 1 });
      expect(onResize).toHaveBeenLastCalledWith(550);
      fireEvent.pointerMove(h, { clientX: 700, pointerId: 1 });
      fireEvent.lostPointerCapture(h, { pointerId: 1 });
      expect(onResizeEnd).toHaveBeenCalledWith(600);
    });

    it("only the primary button starts a drag; pointercancel ends it", () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      render(<AnchoredSheet {...base} onResize={onResize} onResizeEnd={onResizeEnd} />);
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      fireEvent.pointerDown(h, { clientX: 600, button: 2, pointerId: 1 });
      fireEvent.pointerMove(h, { clientX: 650, pointerId: 1 });
      expect(onResize).not.toHaveBeenCalled();
      fireEvent.pointerDown(h, { clientX: 600, button: 0, pointerId: 1 });
      fireEvent.pointerMove(h, { clientX: 620, pointerId: 1 });
      fireEvent.pointerCancel(h, { pointerId: 1 });
      fireEvent.lostPointerCapture(h, { pointerId: 1 });
      expect(onResizeEnd).toHaveBeenCalledTimes(1);
      expect(onResizeEnd).toHaveBeenCalledWith(520);
    });

    it("exposes the range on the separator", () => {
      render(<AnchoredSheet {...base} onResize={() => {}} resizeMax={900} resizeMin={200} />);
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      expect(h).toHaveAttribute("aria-valuemin", "200");
      expect(h).toHaveAttribute("aria-valuemax", "900");
      expect(h).toHaveAttribute("aria-valuenow", "500");
    });

    it("a left edge grows when dragged left", () => {
      const onResize = vi.fn();
      render(<AnchoredSheet {...base} onResize={onResize} resizeEdge="left" />);
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      fireEvent.pointerDown(h, { clientX: 100, pointerId: 1 });
      fireEvent.pointerMove(h, { clientX: 60, pointerId: 1 });
      expect(onResize).toHaveBeenLastCalledWith(540);
    });

    it("ignores moves with no drag in progress", () => {
      const onResize = vi.fn();
      render(<AnchoredSheet {...base} onResize={onResize} />);
      fireEvent.pointerMove(screen.getByTestId(AnchoredSheetTestId.ResizeHandle), { clientX: 5 });
      expect(onResize).not.toHaveBeenCalled();
    });

    it("arrow keys step the width", () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      render(
        <AnchoredSheet {...base} onResize={onResize} onResizeEnd={onResizeEnd} resizeStep={50} />,
      );
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      fireEvent.keyDown(h, { key: "ArrowRight" });
      expect(onResizeEnd).toHaveBeenLastCalledWith(550);
      fireEvent.keyDown(h, { key: "ArrowLeft" });
      expect(onResize).toHaveBeenLastCalledWith(450);
    });
  });
});
