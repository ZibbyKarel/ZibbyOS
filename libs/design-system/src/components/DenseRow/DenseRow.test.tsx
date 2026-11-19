import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DenseRow, DenseRowList, DenseRowTestId } from "./DenseRow";

describe("DenseRow", () => {
  it("renders title, cells and trailing; the title opens", async () => {
    const onOpen = vi.fn();
    render(
      <DenseRowList>
        <DenseRow
          cells={["Každou hodinu", "před 12 min"]}
          onOpen={onOpen}
          title="Úklid"
          trailing={<i>sw</i>}
        />
      </DenseRowList>,
    );
    expect(screen.getAllByTestId(DenseRowTestId.Cell)).toHaveLength(2);
    expect(screen.getByTestId(DenseRowTestId.Trailing)).toHaveTextContent("sw");
    await userEvent.click(screen.getByRole("button", { name: "Úklid" }));
    expect(onOpen).toHaveBeenCalled();
  });
  it("renders a plain title without onOpen", () => {
    render(
      <DenseRowList>
        <DenseRow title="Úklid" />
      </DenseRowList>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId(DenseRowTestId.Title)).toHaveTextContent("Úklid");
  });
});
