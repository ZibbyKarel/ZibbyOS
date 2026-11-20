import type { InboxPrThread } from "@zibby/contracts";
import { fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render, screen } from "../../../test/render";
import { ReviewThreadTestId } from "../../inbox/components/ReviewThread/ReviewThread";
import { PrRepliesWidgetCard, PrRepliesWidgetCardTestId } from "./PrRepliesWidgetCard";

const hooks = vi.hoisted(() => ({
  threads: [] as InboxPrThread[],
  mutateAsync: vi.fn(),
}));
vi.mock("../../projects/queries", () => ({
  useProjectsQuery: () => ({
    data: [{ id: "api", gitRemote: "git@github.com:org/repo.git" }],
    isPending: false,
  }),
}));
vi.mock("../../inbox/queries", () => ({
  useInboxPrThreadsQuery: () => ({
    data: hooks.threads,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("../../inbox/mutations", () => ({
  useReplyInboxPrThreadMutation: () => ({
    mutateAsync: hooks.mutateAsync,
    isPending: false,
    variables: undefined,
  }),
}));

const T1 = "PRRT_one";
const T2 = "PRRT_two";
const T3 = "PRRT_three";

const thread = (id: string, isResolved = false): InboxPrThread => ({
  id,
  isResolved,
  isOutdated: false,
  path: `src/${id}.ts`,
  line: 1,
  startLine: null,
  diffHunk: "@@ -1 +1 @@\n+x",
  comments: [{ id: `${id}-c`, author: null, createdAt: "2026-10-22T11:58:00Z", body: "hi" }],
});

const widget = (replies: { threadId: string; body?: string; resolve?: boolean }[]) => ({
  kind: "pr-replies" as const,
  repo: "org/repo",
  number: 7,
  url: "https://github.com/org/repo/pull/7",
  replies,
});

describe("PrRepliesWidgetCard", () => {
  beforeEach(() => {
    hooks.threads = [thread(T1), thread(T2), thread(T3, true)];
    hooks.mutateAsync.mockReset().mockResolvedValue({});
  });

  it("prefills the proposed body and posts nothing on render", () => {
    render(<PrRepliesWidgetCard widget={widget([{ threadId: T1, body: "Fixed in abc" }])} />);
    expect(screen.getByTestId(ReviewThreadTestId.ReplyInput)).toHaveValue("Fixed in abc");
    expect(hooks.mutateAsync).not.toHaveBeenCalled();
  });

  it("sends one draft with the right params and body", async () => {
    render(<PrRepliesWidgetCard widget={widget([{ threadId: T1, body: "Fixed" }])} />);
    fireEvent.click(screen.getByTestId(ReviewThreadTestId.Send));
    await waitFor(() =>
      expect(hooks.mutateAsync).toHaveBeenCalledWith({
        params: { projectId: "api", number: 7, threadId: T1 },
        body: { body: "Fixed" },
      }),
    );
    expect(await screen.findByTestId(PrRepliesWidgetCardTestId.Sent)).toBeInTheDocument();
  });

  it("Send all sends every unsent draft sequentially", async () => {
    render(
      <PrRepliesWidgetCard
        widget={widget([
          { threadId: T1, body: "A" },
          { threadId: T2, resolve: true },
        ])}
      />,
    );
    fireEvent.click(screen.getByTestId(PrRepliesWidgetCardTestId.SendAll));
    await waitFor(() => expect(hooks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(hooks.mutateAsync.mock.calls[0]?.[0].params.threadId).toBe(T1);
    expect(hooks.mutateAsync.mock.calls[1]?.[0].body).toEqual({ resolve: true });
  });

  it("a draft already posted to the thread (card reopened later) is not offered again", () => {
    hooks.threads = [
      {
        ...thread(T1),
        comments: [...thread(T1).comments, { ...thread(T1).comments[0]!, body: "Fixed" }],
      },
    ];
    render(<PrRepliesWidgetCard widget={widget([{ threadId: T1, body: "Fixed" }])} />);
    expect(screen.getByTestId(PrRepliesWidgetCardTestId.Sent)).toBeInTheDocument();
    expect(screen.queryByTestId(PrRepliesWidgetCardTestId.SendAll)).toBeNull();
  });

  it("renders a resolved thread read-only and flags an unknown one", () => {
    render(
      <PrRepliesWidgetCard
        widget={widget([
          { threadId: T3, body: "late" },
          { threadId: "PRRT_gone", body: "x" },
        ])}
      />,
    );
    expect(screen.getByTestId(PrRepliesWidgetCardTestId.Resolved)).toBeInTheDocument();
    expect(screen.getByTestId(PrRepliesWidgetCardTestId.Missing)).toBeInTheDocument();
    expect(screen.queryByTestId(ReviewThreadTestId.ReplyInput)).toBeNull();
    expect(screen.queryByTestId(PrRepliesWidgetCardTestId.SendAll)).toBeNull();
  });
});
