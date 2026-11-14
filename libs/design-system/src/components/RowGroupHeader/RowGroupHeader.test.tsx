import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProgressTestId } from "../Progress/Progress";
import { render } from "../../utils/testRender";
import { RowGroupHeader, RowGroupHeaderTestId } from "./RowGroupHeader";

describe("RowGroupHeader", () => {
  it("shows caret, key, title, count and toggles", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <RowGroupHeader
        closed={false}
        count="02/05"
        groupKey="EP-1"
        label="Epic"
        onToggle={onToggle}
        progress={40}
        title="Checkout"
      />,
    );
    const root = screen.getByTestId(RowGroupHeaderTestId.Root);
    expect(root).toHaveAttribute("aria-expanded", "true");
    expect(root).toHaveAccessibleName("Epic");
    expect(screen.getByTestId(RowGroupHeaderTestId.Caret)).toHaveTextContent("▾");
    expect(screen.getByTestId(RowGroupHeaderTestId.Key)).toHaveTextContent("EP-1");
    expect(screen.getByTestId(RowGroupHeaderTestId.Title)).toHaveTextContent("Checkout");
    expect(screen.getByTestId(RowGroupHeaderTestId.Count)).toHaveTextContent("02/05");
    expect(screen.getByTestId(ProgressTestId.Fill)).toHaveStyle({ width: "40%" });
    await userEvent.click(root);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(
      <RowGroupHeader closed count="" groupKey="" onToggle={onToggle} progress={0} title="" />,
    );
    expect(screen.getByTestId(RowGroupHeaderTestId.Caret)).toHaveTextContent("▸");
  });

  it("epic variant: chevron, optional key, 72px bar and fraction", () => {
    const { rerender } = render(
      <RowGroupHeader
        closed={false}
        count="18/47"
        groupKey="EP-1"
        onToggle={() => {}}
        progress={38}
        title="Addons"
        variant="epic"
      />,
    );
    expect(screen.getByTestId(RowGroupHeaderTestId.Root)).toHaveAttribute("data-variant", "epic");
    expect(screen.getByTestId(RowGroupHeaderTestId.Root)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId(RowGroupHeaderTestId.Key)).toHaveTextContent("EP-1");
    expect(screen.getByTestId(RowGroupHeaderTestId.Count)).toHaveTextContent("18/47");
    expect(screen.getByTestId(ProgressTestId.Root)).toBeInTheDocument();
    rerender(
      <RowGroupHeader
        closed
        count="03"
        groupKey=""
        onToggle={() => {}}
        title="No epic"
        variant="epic"
      />,
    );
    expect(screen.queryByTestId(RowGroupHeaderTestId.Key)).toBeNull();
    expect(screen.queryByTestId(ProgressTestId.Root)).toBeNull();
    expect(screen.getByTestId(RowGroupHeaderTestId.Root)).toHaveAttribute("aria-expanded", "false");
  });
});
