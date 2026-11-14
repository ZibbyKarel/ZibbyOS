import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { PaperAdd, PaperLine, PaperLineProps, PaperSheet, PaperSheetTestId } from "./PaperSheet";

const line = (p: Partial<PaperLineProps> = {}) => (
  <PaperLine checkLabel="Done" onCheck={() => {}} text="ask @anna to review" {...p} />
);

describe("PaperSheet", () => {
  it("renders the surface with lines and the add row", () => {
    render(
      <PaperSheet>
        {line()}
        <PaperAdd>input</PaperAdd>
      </PaperSheet>,
    );
    expect(screen.getByTestId(PaperSheetTestId.Root)).toBeInTheDocument();
    expect(screen.getByTestId(PaperSheetTestId.Line)).toBeInTheDocument();
    expect(screen.getByTestId(PaperSheetTestId.Add)).toHaveTextContent("input");
  });

  it("marks @mentions only", () => {
    render(line({ text: "ping @anna and bob@x" }));
    expect(screen.getAllByTestId(PaperSheetTestId.Mention).map((e) => e.textContent)).toEqual([
      "@anna",
    ]);
    expect(screen.getByTestId(PaperSheetTestId.Text)).toHaveTextContent("ping @anna and bob@x");
  });

  it("fires onCheck from the checkbox", async () => {
    const onCheck = vi.fn();
    render(line({ onCheck, rowKey: "w:1" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Done" }));
    expect(onCheck).toHaveBeenCalledOnce();
    expect(screen.getByTestId(PaperSheetTestId.Line)).toHaveAttribute("data-rk", "w:1");
  });
});
