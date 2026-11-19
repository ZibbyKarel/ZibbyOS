import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PluginShelf, PluginShelfTestId } from "./PluginShelf";

describe("PluginShelf", () => {
  it("fills proportionally and shows the overflow", () => {
    render(<PluginShelf installed={7} total={12} />);
    expect(screen.getAllByTestId(PluginShelfTestId.Installed)).toHaveLength(4);
    expect(screen.getAllByTestId(PluginShelfTestId.Available)).toHaveLength(2);
    expect(screen.getByTestId(PluginShelfTestId.More)).toHaveTextContent("+6");
  });

  it("is all available when nothing is installed and empty for an empty catalog", () => {
    const { rerender } = render(<PluginShelf installed={0} total={3} />);
    expect(screen.queryAllByTestId(PluginShelfTestId.Installed)).toHaveLength(0);
    expect(screen.getAllByTestId(PluginShelfTestId.Available)).toHaveLength(3);
    rerender(<PluginShelf installed={0} total={0} />);
    expect(screen.queryByTestId(PluginShelfTestId.More)).toBeNull();
  });
});
