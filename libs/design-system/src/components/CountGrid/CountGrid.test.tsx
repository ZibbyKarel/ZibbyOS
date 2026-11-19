import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountGrid, CountGridTestId } from "./CountGrid";

describe("CountGrid", () => {
  it("renders link cells and plain cells", () => {
    render(
      <CountGrid
        items={[
          { id: "a", label: "Běží", value: 2, tone: "run", href: "/runs?x=1", testId: "cell-a" },
          { id: "b", label: "Celkem", value: 0 },
        ]}
      />,
    );
    expect(screen.getByTestId("cell-a")).toHaveAttribute("href", "/runs?x=1");
    expect(screen.getByTestId(CountGridTestId.Cell)).toHaveTextContent("Celkem0");
  });
});
