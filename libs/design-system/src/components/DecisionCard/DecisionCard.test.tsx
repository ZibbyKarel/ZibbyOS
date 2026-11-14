import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { DecisionCard, DecisionCardTestId } from "./DecisionCard";

describe("DecisionCard", () => {
  it("renders context, title, body and actions; no actions slot when omitted", () => {
    const { rerender } = render(
      <DecisionCard
        actions={<button type="button">Approve</button>}
        context="CI triage"
        title="Run it"
      >
        Because.
      </DecisionCard>,
    );
    expect(screen.getByTestId(DecisionCardTestId.Root)).toHaveRole("article");
    expect(screen.getByTestId(DecisionCardTestId.Context)).toHaveTextContent("CI triage");
    expect(screen.getByTestId(DecisionCardTestId.Title)).toHaveTextContent("Run it");
    expect(screen.getByTestId(DecisionCardTestId.Body)).toHaveTextContent("Because.");
    expect(screen.getByTestId(DecisionCardTestId.Actions)).toHaveTextContent("Approve");
    rerender(<DecisionCard context="CI triage" title="Run it" />);
    expect(screen.queryByTestId(DecisionCardTestId.Actions)).toBeNull();
    expect(screen.queryByTestId(DecisionCardTestId.Body)).toBeNull();
  });
});
