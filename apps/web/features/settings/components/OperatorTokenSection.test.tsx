import { renderSettings as render, screen } from "../testing/renderSettings";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import cs from "../../../i18n/messages/cs.json";
import { OPERATOR_TOKEN_STORAGE_KEY } from "../../../state/operatorToken";
import { OperatorTokenSection, OperatorTokenSectionTestId } from "./OperatorTokenSection";

beforeEach(() => localStorage.clear());

describe("OperatorTokenSection", () => {
  it("reads missing when nothing is stored and writes no metadata on mount", () => {
    render(<OperatorTokenSection />);
    expect(screen.getByTestId(OperatorTokenSectionTestId.Status)).toHaveTextContent(
      cs.settings.operatorTokenMissing,
    );
    expect(localStorage.getItem("zibby.operatorToken.meta")).toBeNull();
  });

  it("saving persists the token, masks it and records metadata", async () => {
    render(<OperatorTokenSection />);
    await userEvent.type(screen.getByTestId(OperatorTokenSectionTestId.Input), "tok-123");
    await userEvent.click(screen.getByTestId(OperatorTokenSectionTestId.Save));
    expect(localStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY)).toBe("tok-123");
    expect(localStorage.getItem("zibby.operatorToken.meta")).not.toBeNull();
    expect(screen.getByTestId(OperatorTokenSectionTestId.Status)).toHaveTextContent(
      cs.settings.operatorTokenSaved,
    );
    expect(screen.getByText("•••• -123")).toBeInTheDocument();
  });

  it("remove clears token and metadata", async () => {
    localStorage.setItem(OPERATOR_TOKEN_STORAGE_KEY, "abcd1234");
    render(<OperatorTokenSection />);
    await userEvent.click(screen.getByTestId(OperatorTokenSectionTestId.Remove));
    expect(localStorage.getItem(OPERATOR_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
