import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { LauncherGrid, LauncherTile, LauncherTileTestId } from "./LauncherTile";

describe("LauncherTile", () => {
  it("renders label and key, and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <LauncherGrid>
        <LauncherTile icon="pin" label="Agents" onClick={onClick} rowKey="w:page:/a" />
      </LauncherGrid>,
    );
    expect(screen.getByTestId(LauncherTileTestId.Grid)).toBeInTheDocument();
    expect(screen.getByTestId(LauncherTileTestId.Label)).toHaveTextContent("Agents");
    const tile = screen.getByTestId(LauncherTileTestId.Root);
    expect(tile).toHaveAttribute("data-rk", "w:page:/a");
    expect(tile).toHaveAccessibleName("Agents");
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
