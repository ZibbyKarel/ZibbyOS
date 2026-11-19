import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSection, ListSectionTestId } from "./ListSection";

describe("ListSection", () => {
  it("renders title, count, hint and children", () => {
    render(
      <ListSection code="ENG" count={4} hint="cron" title="Vývoj">
        <div>body</div>
      </ListSection>,
    );
    expect(screen.getByTestId(ListSectionTestId.Title)).toHaveTextContent("Vývoj");
    expect(screen.getByTestId(ListSectionTestId.Count)).toHaveTextContent("4");
    expect(screen.getByTestId(ListSectionTestId.Hint)).toHaveTextContent("cron");
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
