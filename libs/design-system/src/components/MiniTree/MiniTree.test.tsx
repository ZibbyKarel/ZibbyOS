import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniTree, MiniTreeTestId } from "./MiniTree";

describe("MiniTree", () => {
  it("renders the root and one row per child", () => {
    render(
      <MiniTree
        root={{ label: "zibbycorp" }}
        rows={[
          { id: "a", label: "Platforma", trailing: <span>3</span> },
          { id: "b", label: "Růst" },
        ]}
      />,
    );
    expect(screen.getByTestId(MiniTreeTestId.RootLabel)).toHaveTextContent("zibbycorp");
    expect(screen.getAllByTestId(MiniTreeTestId.Row)).toHaveLength(2);
  });
});
