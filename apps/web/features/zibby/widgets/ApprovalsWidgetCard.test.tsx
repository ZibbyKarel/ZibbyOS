import { renderWithProviders as render, screen } from "../../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApprovalsWidgetCard, ApprovalsWidgetCardTestId } from "./ApprovalsWidgetCard";
import { ChatWidgetFrameTestId } from "./ChatWidgetFrame";

const { list, approveMutate, rejectMutate } = vi.hoisted(() => ({
  list: vi.fn(),
  approveMutate: vi.fn(),
  rejectMutate: vi.fn(),
}));
vi.mock("../../approvals", () => ({
  useApprovalsQuery: list,
  useApproveMutation: () => ({ mutate: approveMutate, isPending: false }),
  useRejectMutation: () => ({ mutate: rejectMutate, isPending: false }),
}));
vi.mock("../../runs/queries/useRunsQuery", () => ({
  useRunsQuery: () => ({ runs: [], isPending: false, isError: false, refetch: vi.fn() }),
}));

const approval = (id: string) => ({
  id,
  runId: `run-${id}`,
  kind: "agent",
  skill: "writer",
  action: "git.push",
  detail: `Push ${id}`,
  text: `Push ${id}`,
  risk: "low",
  status: "pending",
  requestedAt: "2026-11-15T08:00:00.000Z",
});

describe("ApprovalsWidgetCard", () => {
  beforeEach(() => {
    approveMutate.mockReset();
    rejectMutate.mockReset();
  });

  it("approve calls the shared mutation, then the row settles in place", async () => {
    list.mockReturnValue({ data: [approval("a1")], isPending: false, isError: false });
    approveMutate.mockImplementation((_v, opts) => opts.onSuccess());
    render(<ApprovalsWidgetCard widget={{ kind: "approvals" }} />);
    const btn = screen.getByTestId(`${ApprovalsWidgetCardTestId.Approve}-a1`);
    expect(btn).toHaveAccessibleName("Schválit: Push a1");
    await userEvent.click(btn);
    expect(approveMutate).toHaveBeenCalledWith(
      { params: { id: "a1" }, body: {} },
      expect.any(Object),
    );
    expect(screen.getByTestId(`${ApprovalsWidgetCardTestId.Settled}-a1`)).toHaveTextContent(
      "Schváleno",
    );
    expect(screen.queryByTestId(`${ApprovalsWidgetCardTestId.Approve}-a1`)).not.toBeInTheDocument();
  });

  it("reject calls the reject mutation", async () => {
    list.mockReturnValue({ data: [approval("a2")], isPending: false, isError: false });
    render(<ApprovalsWidgetCard widget={{ kind: "approvals" }} />);
    await userEvent.click(screen.getByTestId(`${ApprovalsWidgetCardTestId.Reject}-a2`));
    expect(rejectMutate).toHaveBeenCalledWith(
      { params: { id: "a2" }, body: {} },
      expect.any(Object),
    );
  });

  it("respects limit with +N more and shows the empty line", () => {
    list.mockReturnValue({
      data: [approval("a"), approval("b"), approval("c")],
      isPending: false,
      isError: false,
    });
    const { rerender } = render(<ApprovalsWidgetCard widget={{ kind: "approvals", limit: 2 }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.More)).toHaveTextContent("+1 dalších");
    list.mockReturnValue({ data: [], isPending: false, isError: false });
    rerender(<ApprovalsWidgetCard widget={{ kind: "approvals" }} />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent(
      "Nic nečeká na schválení",
    );
  });
});
