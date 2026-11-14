import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { SummaryRow, SummaryRowTestId } from "./SummaryRow";

describe("SummaryRow", () => {
  it("renders label + value and toggles on click", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <SummaryRow icon="grid" label="Project status" onClick={onClick} value="1 failing" />,
    );
    const root = screen.getByTestId(SummaryRowTestId.Root);
    expect(root).toHaveRole("button");
    expect(root).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId(SummaryRowTestId.Label)).toHaveTextContent("Project status");
    expect(screen.getByTestId(SummaryRowTestId.Value)).toHaveTextContent("1 failing");
    await userEvent.click(root);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<SummaryRow expanded icon="grid" label="Project status" onClick={onClick} />);
    expect(screen.getByTestId(SummaryRowTestId.Root)).toHaveAttribute("aria-expanded", "true");
  });
});
