import { renderWithProviders as render, screen } from "../../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CodeBlockTestId } from "@zibby/design-system";
import { ChatApprovalWidgetCard, ChatApprovalWidgetCardTestId } from "./ChatApprovalWidgetCard";

const { one, approveMutate, rejectMutate } = vi.hoisted(() => ({
  one: vi.fn(),
  approveMutate: vi.fn(),
  rejectMutate: vi.fn(),
}));
vi.mock("../../approvals", () => ({
  useApprovalQuery: one,
  useApproveMutation: () => ({ mutate: approveMutate, isPending: false }),
  useRejectMutation: () => ({ mutate: rejectMutate, isPending: false }),
}));

const LONG = `cat > /tmp/zibby-check.md <<'EOF'\n${"line\n".repeat(200)}EOF`;
const approval = (over: Record<string, unknown> = {}) => ({
  id: "ap1",
  runId: "c1/abcd",
  kind: "chat",
  skill: "chat",
  action: "file.write",
  detail: "Actions: file.write",
  summary: "Actions: file.write",
  preview: { kind: "command", shell: "bash", cmd: LONG, targets: [] },
  risk: "low",
  status: "pending",
  requestedAt: "2026-11-27T08:00:00.000Z",
  ...over,
});
const widget = { kind: "approval", approvalId: "ap1" } as const;

describe("ChatApprovalWidgetCard", () => {
  beforeEach(() => {
    approveMutate.mockReset();
    rejectMutate.mockReset();
  });

  it("pending shows the full command and both labelled buttons", () => {
    one.mockReturnValue({ data: approval(), isPending: false, isError: false });
    render(<ChatApprovalWidgetCard widget={widget} />);
    expect(screen.getByTestId(CodeBlockTestId.Pre)).toHaveTextContent(/EOF$/);
    expect(screen.getByTestId(CodeBlockTestId.Pre).textContent).toBe(LONG);
    expect(screen.getByTestId(ChatApprovalWidgetCardTestId.Approve)).toHaveAccessibleName(
      "Schválit: Actions: file.write",
    );
    expect(screen.getByTestId(ChatApprovalWidgetCardTestId.Reject)).toHaveAccessibleName(
      "Zamítnout: Actions: file.write",
    );
  });

  it("approve calls the shared mutation with the id", async () => {
    one.mockReturnValue({ data: approval(), isPending: false, isError: false });
    render(<ChatApprovalWidgetCard widget={widget} />);
    await userEvent.click(screen.getByTestId(ChatApprovalWidgetCardTestId.Approve));
    expect(approveMutate).toHaveBeenCalledWith(
      { params: { id: "ap1" }, body: {} },
      expect.any(Object),
    );
  });

  it("reject calls the reject mutation", async () => {
    one.mockReturnValue({ data: approval(), isPending: false, isError: false });
    render(<ChatApprovalWidgetCard widget={widget} />);
    await userEvent.click(screen.getByTestId(ChatApprovalWidgetCardTestId.Reject));
    expect(rejectMutate).toHaveBeenCalledWith(
      { params: { id: "ap1" }, body: {} },
      expect.any(Object),
    );
  });

  it("an approved approval renders settled with no buttons", () => {
    one.mockReturnValue({
      data: approval({ status: "approved" }),
      isPending: false,
      isError: false,
    });
    render(<ChatApprovalWidgetCard widget={widget} />);
    expect(screen.queryByTestId(ChatApprovalWidgetCardTestId.Approve)).toBeNull();
    expect(screen.queryByTestId(ChatApprovalWidgetCardTestId.Reject)).toBeNull();
    expect(screen.getByText("Schváleno")).toBeInTheDocument();
  });

  it("a turn-ended rejection renders as expired", () => {
    one.mockReturnValue({
      data: approval({ status: "rejected", reason: "Chat turn ended before a decision." }),
      isPending: false,
      isError: false,
    });
    render(<ChatApprovalWidgetCard widget={widget} />);
    expect(screen.queryByTestId(ChatApprovalWidgetCardTestId.Approve)).toBeNull();
    expect(screen.getByText("Vypršelo")).toBeInTheDocument();
  });
});
