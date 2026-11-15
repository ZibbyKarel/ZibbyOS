import {
  AnchoredSheet,
  type AnchoredSheetProps,
  AnchoredSheetTestId,
  WidgetFrameTestId,
} from "@zibby/design-system";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderWithProviders as render, screen } from "../../../test/render";
import type { BridgeSelection } from "../widgets/registry";
import { DetailSheet } from "./DetailSheet";

const uiMock = vi.hoisted(() => ({
  widths: {} as Record<string, number>,
  setBridge: vi.fn(),
}));
vi.mock("../../system", () => ({
  useUiSettings: () => ({
    ui: { bridge: { sheetWidths: uiMock.widths } },
    loaded: true,
    setBridge: uiMock.setBridge,
  }),
}));

// The real sheets pull in queries / mutations — this test is about anchoring + keys.
vi.mock("./sheets/IssueSheet", () => ({
  IssueSheet: (p: {
    id: string;
    anchor: { side: string; left: number; width: number; eT: number; eH: number };
    frame?: {
      nav: Pick<AnchoredSheetProps, "onResize" | "onResizeEnd" | "resizeLabel">;
    };
  }) => (
    <AnchoredSheet
      closeLabel="Close"
      kind="Issue"
      onClose={() => {}}
      title="t"
      {...p.anchor}
      {...p.frame?.nav}
      height={10}
      top={0}
    >
      <div data-anchor={JSON.stringify(p.anchor)} data-id={p.id} data-testid="issue-sheet" />
    </AnchoredSheet>
  ),
}));
vi.mock("./sheets/TaskSheet", () => ({ TaskSheet: () => null }));
vi.mock("./sheets/PrSheet", () => ({ PrSheet: () => null }));
vi.mock("./sheets/RunSheet", () => ({ RunSheet: () => null }));
vi.mock("./sheets/NoteSheet", () => ({ NoteSheet: () => null }));
vi.mock("./sheets/ProjectSheet", () => ({ ProjectSheet: () => null }));
vi.mock("./sheets/AutomationSheet", () => ({ AutomationSheet: () => null }));
vi.mock("./sheets/QuickActionSheet", () => ({ QuickActionSheet: () => null }));

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const ROWS = ["a", "b", "c"];

function Harness({
  initial,
  onSideChange,
}: {
  initial?: string;
  onSideChange?: (s: "left" | "right") => void;
}) {
  const [sel, setSel] = useState<BridgeSelection | null>(
    initial ? { kind: "issue", id: initial, widgetId: "w1", key: `w1:${initial}` } : null,
  );
  return (
    <div data-testid="root">
      <section data-testid={WidgetFrameTestId.Root}>
        {ROWS.map((r) => (
          <div
            data-rk={`w1:${r}`}
            data-testid={`row-${r}`}
            key={r}
            onClick={() => setSel({ kind: "issue", id: r, widgetId: "w1", key: `w1:${r}` })}
          />
        ))}
      </section>
      <section data-testid={WidgetFrameTestId.Root}>
        <div data-rk="w2:z" data-testid="row-z" />
      </section>
      <textarea data-testid="ta" />
      <DetailSheet onClose={() => setSel(null)} onSideChange={onSideChange} selection={sel} />
    </div>
  );
}

function stubRects() {
  screen.getByTestId("root").getBoundingClientRect = () => rect(0, 100, 1200, 700);
  screen.getByTestId("row-a").getBoundingClientRect = () => rect(10, 150, 300, 30);
  // 1190 - 1000 = 190 free on the right -> opens left
  screen.getByTestId("row-b").getBoundingClientRect = () => rect(700, 200, 490, 30);
  // The sheet meets the widget's edge, not the row's: the frame spans the row being opened.
  const [frame] = screen.getAllByTestId(WidgetFrameTestId.Root);
  if (frame) frame.getBoundingClientRect = () => frameRect;
}

let frameRect = rect(10, 140, 300, 300);
/** Click a row with the widget frame spanning `[left, left + width)` horizontally. */
function open(row: string, left: number, width: number) {
  frameRect = rect(left, 140, width, 300);
  fireEvent.click(screen.getByTestId(`row-${row}`));
}

describe("DetailSheet", () => {
  it("reports the side the sheet opened to", () => {
    const onSideChange = vi.fn();
    render(<Harness onSideChange={onSideChange} />);
    stubRects();
    open("a", 10, 300);
    expect(onSideChange).toHaveBeenLastCalledWith("right");
    open("b", 700, 490);
    expect(onSideChange).toHaveBeenLastCalledWith("left");
  });

  it("anchors right of a row with room, flush with its edge", async () => {
    render(<Harness />);
    stubRects();
    open("a", 10, 300);
    const anchor = JSON.parse(screen.getByTestId("issue-sheet").dataset.anchor ?? "{}");
    expect(anchor).toMatchObject({
      side: "r",
      left: 309,
      width: 480, // issue's preferred width, below the 891px of room
      top: 0,
      height: 700,
      eL: -2,
      eH: 30,
    });
  });

  it("anchors left when the row leaves less room on the right", () => {
    render(<Harness />);
    stubRects();
    open("b", 700, 490);
    const anchor = JSON.parse(screen.getByTestId("issue-sheet").dataset.anchor ?? "{}");
    expect(anchor).toMatchObject({ side: "l", left: 700 + 1 - 480, width: 480, eL: 478 });
  });

  it("meets the widget edge when the row is inset inside it", () => {
    render(<Harness />);
    stubRects();
    // row-b spans 700–1190, its widget 680–1200: the sheet's right edge is the widget's left.
    open("b", 680, 520);
    const anchor = JSON.parse(screen.getByTestId("issue-sheet").dataset.anchor ?? "{}");
    expect(anchor).toMatchObject({ side: "l", left: 680 + 1 - 480, eH: 30 });
  });

  it("ArrowDown / ArrowUp open the next / previous row, within the widget only", () => {
    render(<Harness initial="a" />);
    stubRects();
    fireEvent.click(screen.getByTestId("row-a"));
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("a");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("b");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("c");
    fireEvent.keyDown(window, { key: "ArrowDown" }); // end of the widget: stays (never the next widget's row)
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("c");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("b");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("a");
    // J / K no longer navigate
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "k" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("a");
  });

  it("ignores arrows while typing in a textarea, and does nothing with no selection", () => {
    render(<Harness />);
    stubRects();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.queryByTestId("issue-sheet")).toBeNull();
    fireEvent.click(screen.getByTestId("row-a"));
    fireEvent.keyDown(screen.getByTestId("ta"), { key: "ArrowDown" });
    expect(screen.getByTestId("issue-sheet").dataset.id).toBe("a");
  });

  it("re-measures when the wrapper resizes", async () => {
    render(<Harness />);
    stubRects();
    fireEvent.click(screen.getByTestId("row-a"));
    screen.getByTestId("row-a").getBoundingClientRect = () => rect(10, 160, 300, 30);
    await act(async () => {
      screen.getByTestId("row-a").appendChild(document.createElement("i")); // MutationObserver tick
      await Promise.resolve();
    });
    const anchor = JSON.parse(screen.getByTestId("issue-sheet").dataset.anchor ?? "{}");
    expect(anchor.eT).toBe(160 - 100 - 4);
  });

  it("on a phone every sheet is a full page, even when its row is not on the board", () => {
    const mm = vi.spyOn(window, "matchMedia").mockImplementation(
      (q) =>
        ({
          matches: true,
          media: q,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    render(<Harness initial="missing" />);
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveAttribute(
      "data-presentation",
      "page",
    );
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveAttribute("aria-modal", "true");
    mm.mockRestore();
  });

  it("on desktop the sheet stays anchored", () => {
    render(<Harness />);
    stubRects();
    fireEvent.click(screen.getByTestId("row-a"));
    expect(screen.getByTestId(AnchoredSheetTestId.Root)).toHaveAttribute(
      "data-presentation",
      "anchored",
    );
  });

  describe("sheet width", () => {
    // jsdom has no PointerEvent; MouseEvent carries the clientX the handler reads.
    beforeEach(() => void vi.stubGlobal("PointerEvent", MouseEvent));
    afterEach(() => void vi.unstubAllGlobals());
    const widthOf = () =>
      JSON.parse(screen.getByTestId("issue-sheet").dataset.anchor ?? "{}").width;
    const drag = (toX: number) => {
      const h = screen.getByTestId(AnchoredSheetTestId.ResizeHandle);
      // the handle starts at the sheet's right edge: 309 + 480 = 789
      fireEvent.pointerDown(h, { clientX: 789, pointerId: 1 });
      fireEvent.pointerMove(h, { clientX: toX, pointerId: 1 });
    };
    const end = () =>
      fireEvent.lostPointerCapture(screen.getByTestId(AnchoredSheetTestId.ResizeHandle), {
        pointerId: 1,
      });

    it("a drag snaps to 5 % of the page (60 px of 1200) and persists per kind on release", () => {
      uiMock.widths = {};
      uiMock.setBridge.mockClear();
      render(<Harness />);
      stubRects();
      open("a", 10, 300);
      expect(widthOf()).toBe(480);
      drag(789 + 170); // 650 px -> 10.83 columns -> 11 -> 55 % = 660 px
      expect(widthOf()).toBe(660);
      expect(uiMock.setBridge).not.toHaveBeenCalled(); // live only until release
      end();
      expect(widthOf()).toBe(660);
      expect(uiMock.setBridge).toHaveBeenCalledWith({ sheetWidths: { issue: 55 } });
    });

    it("clamps to the free space beside the widget", () => {
      uiMock.widths = {};
      render(<Harness />);
      stubRects();
      open("a", 10, 300); // 891 px free on the right = 14 columns = 70 %
      drag(789 + 600);
      expect(widthOf()).toBe(840);
    });

    it("opens at the saved width, falling back to the kind default", () => {
      uiMock.widths = { issue: 40 };
      render(<Harness />);
      stubRects();
      open("a", 10, 300);
      expect(widthOf()).toBe(480); // 40 % of 1200
      uiMock.widths = { issue: 25 };
      fireEvent.click(screen.getByTestId("row-b"));
      expect(widthOf()).toBe(300);
    });

    it("arrow keys step exactly one column even on a 1920 px page", () => {
      uiMock.widths = {};
      uiMock.setBridge.mockClear();
      render(<Harness />);
      stubRects();
      screen.getByTestId("root").getBoundingClientRect = () => rect(0, 100, 1920, 700);
      open("a", 10, 300);
      expect(widthOf()).toBe(480); // 25 %
      fireEvent.keyDown(screen.getByTestId(AnchoredSheetTestId.ResizeHandle), {
        key: "ArrowRight",
      });
      expect(widthOf()).toBe(576); // 30 % = one column (96 px) wider
      expect(uiMock.setBridge).toHaveBeenLastCalledWith({ sheetWidths: { issue: 30 } });
    });

    it("an abandoned drag does not leak into the next opened sheet", () => {
      uiMock.widths = {};
      render(<Harness />);
      stubRects();
      open("a", 10, 300);
      drag(789 + 170); // never released
      expect(widthOf()).toBe(660);
      fireEvent.click(screen.getByTestId("row-b"));
      expect(widthOf()).toBe(480);
    });

    it("has no handle on a phone", () => {
      const mm = vi.spyOn(window, "matchMedia").mockImplementation(
        (q) =>
          ({
            matches: true,
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
      render(<Harness initial="missing" />);
      expect(screen.queryByTestId(AnchoredSheetTestId.ResizeHandle)).toBeNull();
      mm.mockRestore();
    });
  });
});
