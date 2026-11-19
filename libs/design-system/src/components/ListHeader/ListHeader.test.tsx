import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListHeader, ListHeaderTestId } from "./ListHeader";

describe("ListHeader", () => {
  it("renders crumb, title, count fragments and actions", () => {
    render(
      <ListHeader
        actions={<button type="button">New</button>}
        count={[
          { text: "3 firms", tone: "plain" },
          { text: "2 running", tone: "run" },
        ]}
        route="/companies"
        section="Organization"
        title="Companies"
      />,
    );
    expect(screen.getByTestId(ListHeaderTestId.Crumb)).toHaveTextContent(
      "Organization / /companies",
    );
    expect(screen.getByTestId(ListHeaderTestId.Title)).toHaveTextContent("Companies");
    expect(screen.getByTestId(ListHeaderTestId.Count)).toHaveTextContent("3 firms · 2 running");
    expect(screen.getByTestId(ListHeaderTestId.Actions)).toBeInTheDocument();
  });
});
