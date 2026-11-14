import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { MenuButtonTestId } from "../MenuButton/MenuButton";
import { WidgetFrame, WidgetFrameTestId } from "./WidgetFrame";

const CORNERS = ["nw", "ne", "sw", "se"] as const;
const resizeId = (c: string) => `${WidgetFrameTestId.Resize}-${c}`;

describe("WidgetFrame", () => {
  it("renders header parts and body", () => {
    render(
      <WidgetFrame aside="ALL CLEAR" count="04" label="ISSUES" you="02 YOU">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Label)).toHaveTextContent("ISSUES");
    expect(screen.getByTestId(WidgetFrameTestId.Count)).toHaveTextContent("04");
    expect(screen.getByTestId(WidgetFrameTestId.You)).toHaveTextContent("02 YOU");
    expect(screen.getByTestId(WidgetFrameTestId.Aside)).toHaveTextContent("ALL CLEAR");
    expect(screen.getByText("rows")).toBeVisible();
  });

  it("rises above the sheet overlay while anchored", () => {
    const { rerender } = render(<WidgetFrame label="PRS" />);
    expect(screen.getByTestId(WidgetFrameTestId.Root)).not.toHaveAttribute("data-anchored");
    rerender(<WidgetFrame anchored label="PRS" />);
    expect(screen.getByTestId(WidgetFrameTestId.Root)).toHaveAttribute("data-anchored", "true");
    expect(screen.getByTestId(WidgetFrameTestId.Root).className).toContain("z-[31]");
  });

  it("shows the caret only when a toggle handler is given and toggles", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<WidgetFrame label="X" />);
    expect(screen.queryByTestId(WidgetFrameTestId.Collapse)).toBeNull();
    rerender(<WidgetFrame label="X" onToggleCollapse={onToggle} />);
    const caret = screen.getByTestId(WidgetFrameTestId.Collapse);
    expect(caret).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(caret);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<WidgetFrame collapsed label="X" onToggleCollapse={onToggle} />);
    expect(screen.getByTestId(WidgetFrameTestId.Collapse)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("hides the body (but keeps it mounted) when collapsed", () => {
    render(
      <WidgetFrame collapsed label="X">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Body)).not.toBeVisible();
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("shows the empty state instead of the (still mounted) children when empty", () => {
    const { rerender } = render(
      <WidgetFrame empty label="X">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Empty)).toBeVisible();
    expect(screen.getByText("rows")).toBeInTheDocument();
    expect(screen.getByText("rows")).not.toBeVisible();
    rerender(
      <WidgetFrame adding empty label="X">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.queryByTestId(WidgetFrameTestId.Empty)).toBeNull();
    expect(screen.getByText("rows")).toBeVisible();
  });

  it("always renders the corner handles; size label only while dragging", async () => {
    const onMove = vi.fn();
    const onResize = vi.fn();
    const { rerender } = render(
      <WidgetFrame
        label="X"
        onMovePointerDown={onMove}
        onResizePointerDown={onResize}
        resizeLabel="Resize"
        sizeLabel="4 × 6"
      />,
    );
    expect(screen.queryByTestId(WidgetFrameTestId.Size)).toBeNull();
    fireEvent.pointerDown(screen.getByTestId(WidgetFrameTestId.Header));
    const names = new Set<string>();
    for (const c of CORNERS) {
      const handle = screen.getByTestId(resizeId(c));
      expect(handle).toHaveRole("separator");
      expect(handle).toHaveAccessibleName(expect.stringMatching(/^Resize \(/));
      names.add(handle.getAttribute("aria-label") ?? "");
      fireEvent.pointerDown(handle);
      expect(onResize).toHaveBeenLastCalledWith(expect.anything(), c);
    }
    expect(names.size).toBe(4);
    expect(screen.getByTestId(resizeId("nw"))).toHaveClass("opacity-0", "group-hover:opacity-100");
    expect(onMove).toHaveBeenCalledOnce();
    rerender(<WidgetFrame dragging label="X" sizeLabel="4 × 6" />);
    expect(screen.getByTestId(WidgetFrameTestId.Size)).toHaveTextContent("4 × 6");
  });

  it("renders an add toggle reflecting `adding`, forces the body open, and does not start a move", async () => {
    const onAdd = vi.fn();
    const onMove = vi.fn();
    const { rerender } = render(
      <WidgetFrame empty addLabel="Add" label="X" onAdd={onAdd} onMovePointerDown={onMove}>
        <p>rows</p>
      </WidgetFrame>,
    );
    const btn = screen.getByTestId(WidgetFrameTestId.Add);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAccessibleName("Add");
    await userEvent.click(btn);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    rerender(
      <WidgetFrame adding empty label="X" onAdd={onAdd}>
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Add)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(WidgetFrameTestId.Body)).toBeVisible();
  });

  it("renders a plain settings button that does not start a move", async () => {
    const onSettings = vi.fn();
    const onMove = vi.fn();
    render(
      <WidgetFrame
        label="X"
        onMovePointerDown={onMove}
        onSettings={onSettings}
        settingsLabel="Settings"
      />,
    );
    const btn = screen.getByTestId(WidgetFrameTestId.Settings);
    expect(btn).toHaveAccessibleName("Settings");
    expect(btn).not.toHaveAttribute("aria-pressed");
    await userEvent.click(btn);
    expect(onSettings).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("keeps the collapse caret last, even when empty", () => {
    render(
      <WidgetFrame
        empty
        label="X"
        onAdd={() => {}}
        onRefresh={() => {}}
        onSettings={() => {}}
        onToggleCollapse={() => {}}
      />,
    );
    const ids = Array.from(
      screen.getByTestId(WidgetFrameTestId.Header).querySelectorAll("button"),
    ).map((b) => b.getAttribute("data-testid"));
    expect(ids).toEqual([
      WidgetFrameTestId.Refresh,
      WidgetFrameTestId.Add,
      WidgetFrameTestId.Settings,
      WidgetFrameTestId.Collapse,
    ]);
  });

  it("renders a sync button only with a handler; disabled while refreshing; no move drag", async () => {
    const onRefresh = vi.fn();
    const onMove = vi.fn();
    const { rerender } = render(<WidgetFrame label="X" />);
    expect(screen.queryByTestId(WidgetFrameTestId.Refresh)).toBeNull();
    rerender(
      <WidgetFrame
        label="X"
        onMovePointerDown={onMove}
        onRefresh={onRefresh}
        refreshLabel="Sync"
      />,
    );
    const btn = screen.getByTestId(WidgetFrameTestId.Refresh);
    expect(btn).toHaveAccessibleName("Sync");
    await userEvent.click(btn);
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onMove).not.toHaveBeenCalled();
    rerender(<WidgetFrame refreshing label="X" onRefresh={onRefresh} refreshLabel="Sync" />);
    expect(screen.getByTestId(WidgetFrameTestId.Refresh)).toBeDisabled();
  });

  it("marks dragging with an ink border and passes geometry through", () => {
    render(<WidgetFrame dragging label="X" style={{ left: 10, top: 20 }} />);
    const root = screen.getByTestId(WidgetFrameTestId.Root);
    expect(root).toHaveClass("border-ink");
    expect(root).toHaveStyle({ left: "10px", top: "20px" });
  });

  it("wraps children in the content wrapper", () => {
    render(
      <WidgetFrame label="X">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Content)).toContainElement(
      screen.getByText("rows"),
    );
  });

  it("renders a loader with role=status and the loadingLabel when loading", () => {
    render(<WidgetFrame loading label="X" loadingLabel="Loading…" />);
    const loader = screen.getByTestId(WidgetFrameTestId.Loading);
    expect(loader).toHaveRole("status");
    expect(loader).toHaveAccessibleName("Loading…");
  });

  it("renders no loader when not loading", () => {
    render(<WidgetFrame label="X" />);
    expect(screen.queryByTestId(WidgetFrameTestId.Loading)).toBeNull();
  });

  it("renders a filters toggle between refresh and settings, only with a handler", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <WidgetFrame
        label="X"
        onRefresh={() => {}}
        onSettings={() => {}}
        onToggleFilters={onToggle}
      />,
    );
    const btn = screen.getByTestId(WidgetFrameTestId.Filters);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).not.toHaveAttribute("data-active");
    expect(btn).toHaveAccessibleName("Filters");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledOnce();
    const ids = Array.from(
      screen.getByTestId(WidgetFrameTestId.Header).querySelectorAll("button"),
    ).map((b) => b.getAttribute("data-testid"));
    expect(ids).toEqual([
      WidgetFrameTestId.Refresh,
      WidgetFrameTestId.Filters,
      WidgetFrameTestId.Settings,
    ]);
    rerender(<WidgetFrame filtersActive filtersOpen label="X" onToggleFilters={onToggle} />);
    expect(screen.getByTestId(WidgetFrameTestId.Filters)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(WidgetFrameTestId.Filters)).toHaveAttribute("data-active", "true");
    rerender(<WidgetFrame label="X" />);
    expect(screen.queryByTestId(WidgetFrameTestId.Filters)).not.toBeInTheDocument();
  });

  it("emits tier + species and defaults to the standard tier", () => {
    const { rerender } = render(<WidgetFrame label="X" species="feed" />);
    const root = screen.getByTestId(WidgetFrameTestId.Root);
    expect(root).toHaveAttribute("data-tier", "standard");
    expect(root).toHaveAttribute("data-species", "feed");
    expect(root).toHaveClass("bg-panel", "border-line");
    rerender(<WidgetFrame label="X" tier="primary" />);
    expect(screen.getByTestId(WidgetFrameTestId.Root)).toHaveClass("border-accent/20");
    expect(screen.getByTestId(WidgetFrameTestId.Label)).toHaveClass("text-widget-t1", "text-ink");
    rerender(<WidgetFrame label="X" tier="ambient" />);
    expect(screen.getByTestId(WidgetFrameTestId.Root)).toHaveClass(
      "border-transparent",
      "hover:border-line",
    );
    expect(screen.getByTestId(WidgetFrameTestId.Label)).toHaveClass("text-widget-t3", "text-ink-2");
  });

  it("tier collapsed implies a collapsed body and a dashed frame", () => {
    render(
      <WidgetFrame label="X" onToggleCollapse={() => {}} tier="collapsed">
        <p>rows</p>
      </WidgetFrame>,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Root)).toHaveClass("border-dashed");
    expect(screen.getByTestId(WidgetFrameTestId.Body)).not.toBeVisible();
    expect(screen.getByTestId(WidgetFrameTestId.Collapse)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("hides controls until hover/focus (still focusable) but keeps pressed ones visible", () => {
    const { rerender } = render(
      <WidgetFrame label="X" onAdd={() => {}} onSettings={() => {}} onToggleFilters={() => {}} />,
    );
    const settings = screen.getByTestId(WidgetFrameTestId.Settings);
    expect(settings).toHaveClass(
      "opacity-0",
      "group-hover:opacity-100",
      "group-focus-within:opacity-100",
    );
    settings.focus();
    expect(settings).toHaveFocus();
    rerender(
      <WidgetFrame
        adding
        filtersOpen
        label="X"
        onAdd={() => {}}
        onSettings={() => {}}
        onToggleFilters={() => {}}
      />,
    );
    expect(screen.getByTestId(WidgetFrameTestId.Add)).not.toHaveClass("opacity-0");
    expect(screen.getByTestId(WidgetFrameTestId.Filters)).not.toHaveClass("opacity-0");
    expect(screen.getByTestId(WidgetFrameTestId.Settings)).toHaveClass("opacity-0");
  });

  it("hero tier overlays its header and reveals it on hover/focus", () => {
    render(<WidgetFrame label="Briefing" tier="hero" />);
    expect(screen.getByTestId(WidgetFrameTestId.Header)).toHaveClass(
      "absolute",
      "opacity-0",
      "group-focus-within:opacity-100",
    );
  });

  it("compactControls folds the controls into one menu with the same actions", async () => {
    const onSettings = vi.fn();
    const onMove = vi.fn();
    render(
      <WidgetFrame
        compactControls
        controlsLabel="More"
        label="X"
        onMovePointerDown={onMove}
        onRefresh={() => {}}
        onSettings={onSettings}
        onToggleCollapse={() => {}}
        settingsLabel="Settings"
      />,
    );
    expect(screen.queryByTestId(WidgetFrameTestId.Settings)).toBeNull();
    const controls = screen.getByTestId(WidgetFrameTestId.Controls);
    fireEvent.pointerDown(controls);
    expect(onMove).not.toHaveBeenCalled();
    const trigger = screen.getByTestId(MenuButtonTestId.Trigger);
    expect(trigger).toHaveAccessibleName("More");
    await userEvent.click(trigger);
    const items = screen.getAllByRole("menuitem").map((i) => i.getAttribute("data-testid"));
    expect(items).toEqual([
      "menu-button-item-refresh",
      "menu-button-item-settings",
      "menu-button-item-collapse",
    ]);
    await userEvent.click(screen.getByTestId(`${MenuButtonTestId.Item}-settings`));
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it("renders the you pill with its amber dot", () => {
    render(<WidgetFrame label="X" you="2 for you" />);
    const you = screen.getByTestId(WidgetFrameTestId.You);
    expect(you).toHaveTextContent("2 for you");
    expect(you).toHaveClass("text-accent-fg", "rounded-full");
  });
});
