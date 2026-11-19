import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { Tile, TileGrid, TileGridTestId } from "./TileGrid";

describe("TileGrid", () => {
  it("renders tiles with title, sub and row key", async () => {
    const onClick = vi.fn();
    render(
      <TileGrid>
        <Tile alert selected onClick={onClick} rowKey="w:p1" sub="develop" title="cms4" />
      </TileGrid>,
    );
    const tile = screen.getByTestId(TileGridTestId.Tile);
    expect(tile).toHaveRole("button");
    expect(tile).toHaveAttribute("data-rk", "w:p1");
    expect(tile).toHaveAttribute("data-alert", "true");
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId(TileGridTestId.Title)).toHaveTextContent("cms4");
    expect(screen.getByTestId(TileGridTestId.Sub)).toHaveTextContent("develop");
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows the logo and the whole title (never truncated)", () => {
    render(
      <Tile
        logo={<i data-testid="logo" />}
        title="a-very-long-project-name-that-must-stay-whole"
      />,
    );
    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByTestId(TileGridTestId.Title)).not.toHaveClass("truncate");
  });

  it("is static without onClick and has no alert by default", () => {
    render(<Tile title="x" />);
    const tile = screen.getByTestId(TileGridTestId.Tile);
    expect(tile).not.toHaveRole("button");
    expect(tile).not.toHaveAttribute("data-alert");
  });
});
