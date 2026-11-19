import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAutonomy } from "../test/renderAutonomy";
import { AutomatConfirmDialog, AutomatConfirmTestId, NEVER_KEYS } from "./AutomatConfirmDialog";

const base = {
  open: true,
  exceptions: [],
  pendingApprovals: 3,
  anyOn: true,
  hasToken: true,
  pending: false,
  error: null as "token" | "failed" | null,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

describe("AutomatConfirmDialog", () => {
  it("lists what always asks and confirms with the stored token", async () => {
    const onConfirm = vi.fn();
    renderAutonomy(<AutomatConfirmDialog {...base} onConfirm={onConfirm} />);
    expect(screen.getByTestId(AutomatConfirmTestId.Never)).toHaveTextContent("Merge");
    expect(NEVER_KEYS).toHaveLength(9);
    expect(screen.getByTestId(AutomatConfirmTestId.TokenVerified)).toBeInTheDocument();
    expect(screen.queryByTestId(AutomatConfirmTestId.Token)).toBeNull();
    await userEvent.click(screen.getByTestId(AutomatConfirmTestId.Confirm));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it("needs a typed token without a stored one and passes it on", async () => {
    const onConfirm = vi.fn();
    renderAutonomy(<AutomatConfirmDialog {...base} hasToken={false} onConfirm={onConfirm} />);
    const confirm = screen.getByTestId(AutomatConfirmTestId.Confirm);
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Operátorský token"), "zby_op_1");
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("zby_op_1");
  });

  it("brings the field back after a 401 and blocks an empty Automat", () => {
    const { rerender } = renderAutonomy(<AutomatConfirmDialog {...base} error="token" />);
    expect(screen.getByTestId(AutomatConfirmTestId.Token)).toBeInTheDocument();
    expect(screen.getByTestId(AutomatConfirmTestId.Error)).toBeInTheDocument();
    rerender(<AutomatConfirmDialog {...base} anyOn={false} />);
    expect(screen.getByTestId(AutomatConfirmTestId.NothingOn)).toBeInTheDocument();
    expect(screen.getByTestId(AutomatConfirmTestId.Confirm)).toBeDisabled();
  });
});
