import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillTile, SkillTileTestId } from "./SkillTile";

describe("SkillTile", () => {
  it("renders glyph from the name, source, description and footer", () => {
    render(
      <SkillTile
        description="Reads PDFs"
        footer={<span>FIN</span>}
        name="pdf-tools"
        source="anthropic"
      />,
    );
    expect(screen.getByTestId(SkillTileTestId.Glyph)).toHaveTextContent("pd");
    expect(screen.getByTestId(SkillTileTestId.Name)).toHaveTextContent("pdf-tools");
    expect(screen.getByTestId(SkillTileTestId.Source)).toHaveTextContent("anthropic");
    expect(screen.getByTestId(SkillTileTestId.Description)).toHaveTextContent("Reads PDFs");
    expect(screen.getByTestId(SkillTileTestId.Footer)).toHaveTextContent("FIN");
  });

  it("is not clickable without onOpen and opens with it", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SkillTile name="x" />);
    expect(screen.queryByTestId(SkillTileTestId.Open)).toBeNull();
    rerender(<SkillTile name="x" onOpen={onOpen} openLabel="Open x" />);
    fireEvent.click(screen.getByTestId(SkillTileTestId.Open));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
