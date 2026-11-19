import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import { RoadmapItemSchema } from "../roadmap/roadmap-item.schema";
import {
  AddressInboxPrCommentsInputSchema,
  FixInboxPrCiInputSchema,
  InboxItemsResponseSchema,
  InboxPrDiffSchema,
  InboxPrReviewersSchema,
  InboxPrThreadSchema,
  InboxPrThreadsSchema,
  InboxPrsResponseSchema,
  InboxRefreshQuerySchema,
  InboxStateSchema,
  ProcessInboxItemInputSchema,
  RebaseInboxPrInputSchema,
  ReplyInboxPrThreadInputSchema,
  RequestInboxPrReviewInputSchema,
  ReviewInboxPrInputSchema,
  ReviewInboxPrResultSchema,
  RewritePrReplyInputSchema,
  RewritePrReplyResultSchema,
  SetInboxHiddenSchema,
  SubmitInboxPrReviewInputSchema,
  SubmitInboxPrReviewResultSchema,
  UpdatePrBranchResultSchema,
} from "./inbox.schema";

const c = initContract();

/**
 * Inbox (docs/plans/inbox-ui-spec.md). `listInboxItems` is the cross-project list of issues
 * assigned to the operator, fetched live (docs/plans/live-issues-plan.md); filtering and
 * search run on the client.
 * `/roadmap/items` has no `:projectId` segment, so it cannot collide with the
 * per-project `/projects/:projectId/roadmap/...` routes.
 */
export const inboxContract = c.router(
  {
    listInboxItems: {
      method: "GET",
      path: "/roadmap/items",
      query: InboxRefreshQuerySchema,
      responses: { 200: InboxItemsResponseSchema },
      summary:
        "List the issues assigned to the operator, fetched live from Jira/GitHub across all projects (cached 60 s; refresh=true bypasses)",
    },
    processInboxItem: {
      method: "POST",
      path: "/inbox/items/process",
      body: ProcessInboxItemInputSchema,
      responses: {
        201: RoadmapItemSchema,
        // 404: the item is not in the live list (or its project is gone).
        404: ErrorSchema,
        // 422: the roadmap gate refused it (already in flight, not startable).
        422: ErrorSchema,
      },
      summary:
        "Process one live issue: write a local roadmap record if none exists, then play it through the roadmap gate",
    },
    listInboxPrs: {
      method: "GET",
      path: "/inbox/prs",
      query: InboxRefreshQuerySchema,
      responses: { 200: InboxPrsResponseSchema },
      summary: "List GitHub PRs awaiting the operator's review and the operator's own open PRs",
    },
    reviewInboxPr: {
      method: "POST",
      path: "/inbox/prs/review",
      body: ReviewInboxPrInputSchema,
      responses: {
        201: ReviewInboxPrResultSchema,
        404: ErrorSchema,
        // 422: the project has no GitHub link, or `repo` is not the project's repo.
        422: ErrorSchema,
        // 502: GitLab refused or failed the merge request read (GitLab projects only).
        502: ErrorSchema,
      },
      summary:
        "Start a code review task for one PR (level quick = code-reviewer agent, thorough/tested = pr-review-* workflow); the finished review is parked as a Tier-3 approval to post it as a COMMENT",
    },
    rebaseInboxPr: {
      method: "POST",
      path: "/inbox/prs/rebase",
      body: RebaseInboxPrInputSchema,
      responses: {
        201: UpdatePrBranchResultSchema,
        404: ErrorSchema,
        // 422: no GitHub link, foreign repo, fork head, closed PR, or a head that is the
        // base/default branch.
        422: ErrorSchema,
        // 502: GitLab refused or failed a merge request call (GitLab projects only).
        502: ErrorSchema,
      },
      summary:
        "Update one PR's branch from its base (method merge by default, or rebase): GitHub's server-side update first ({ updated: true }); when it refuses (conflicts) a pr-rebase workflow task resolves them ({ taskId }) and ZIBBY pushes — right away when green, after a Tier-3 approval otherwise",
    },
    addressInboxPrComments: {
      method: "POST",
      path: "/inbox/prs/address-comments",
      body: AddressInboxPrCommentsInputSchema,
      responses: {
        201: ReviewInboxPrResultSchema,
        404: ErrorSchema,
        // 422: no GitHub link, foreign repo, fork head, closed PR, a base/default-branch head,
        // or a run already in flight.
        422: ErrorSchema,
        // 502: GitLab refused or failed a merge request call (GitLab projects only).
        502: ErrorSchema,
      },
      summary:
        "Start an agent that fixes one PR's unresolved review comments (pr-address-comments workflow); ZIBBY fast-forwards the PR head — right away when every comment was addressed with green checks, after a Tier-3 approval otherwise",
    },
    fixInboxPrCi: {
      method: "POST",
      path: "/inbox/prs/fix-ci",
      body: FixInboxPrCiInputSchema,
      responses: {
        201: ReviewInboxPrResultSchema,
        404: ErrorSchema,
        // 422: no GitHub link, foreign repo, fork head, closed PR, a base/default-branch head,
        // or a run already in flight.
        422: ErrorSchema,
        // 502: GitLab refused or failed a merge request call (GitLab projects only).
        502: ErrorSchema,
      },
      summary:
        "Start an agent that fixes one PR's failing CI checks (pr-fix-ci workflow); ZIBBY fast-forwards the PR head — right away on the operator's own PR after a full fix, after a Tier-3 approval otherwise",
    },
    getInboxPrDiff: {
      method: "GET",
      path: "/inbox/prs/:projectId/:number/diff",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
      }),
      responses: {
        200: InboxPrDiffSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        502: ErrorSchema,
      },
      summary:
        "Get one PR's unified diff from GitHub (repo derived from the project's GitHub link)",
    },
    getInboxPrThreads: {
      method: "GET",
      path: "/inbox/prs/:projectId/:number/threads",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
      }),
      responses: {
        200: InboxPrThreadsSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        502: ErrorSchema,
      },
      summary: "List one PR's review threads from GitHub",
    },
    replyInboxPrThread: {
      method: "POST",
      path: "/inbox/prs/:projectId/:number/threads/:threadId/reply",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
        threadId: z.string().regex(/^(?:PRRT_[\w-]+|[0-9a-f]{40})$/),
      }),
      body: ReplyInboxPrThreadInputSchema,
      responses: { 200: InboxPrThreadSchema, 404: ErrorSchema, 422: ErrorSchema, 502: ErrorSchema },
      summary: "Reply to and/or resolve one PR review thread; returns the updated thread",
    },
    rewriteInboxPrReply: {
      method: "POST",
      path: "/inbox/prs/rewrite-reply",
      body: RewritePrReplyInputSchema,
      responses: { 200: RewritePrReplyResultSchema, 422: ErrorSchema, 502: ErrorSchema },
      summary:
        "Rewrite one drafted PR review reply to be shorter or more detailed (LLM one-shot; stays concrete, 422 when no concrete rewrite comes back)",
    },
    submitInboxPrReview: {
      method: "POST",
      path: "/inbox/prs/:projectId/:number/reviews",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
      }),
      body: SubmitInboxPrReviewInputSchema,
      responses: {
        201: SubmitInboxPrReviewResultSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        502: ErrorSchema,
      },
      summary: "Post the operator's own review (approve / request changes / comment) on one PR",
    },
    getInboxPrReviewers: {
      method: "GET",
      path: "/inbox/prs/:projectId/:number/reviewers",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
      }),
      responses: {
        200: InboxPrReviewersSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        502: ErrorSchema,
      },
      summary:
        "Get one PR's reviewers tree from GitHub: teams (CODEOWNER flag for changed files) with their reviewing members, then other people",
    },
    requestInboxPrReview: {
      method: "POST",
      path: "/inbox/prs/:projectId/:number/reviewers/request",
      pathParams: z.object({
        projectId: z.string().min(1),
        number: z.coerce.number().int().positive(),
      }),
      body: RequestInboxPrReviewInputSchema,
      responses: {
        201: InboxPrReviewersSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        502: ErrorSchema,
      },
      summary: "Re-request one person's review on a PR (operator click); returns the updated tree",
    },
    getInboxState: {
      method: "GET",
      path: "/inbox/state",
      responses: { 200: InboxStateSchema },
      summary: "Get the operator's hidden inbox items",
    },
    setInboxHidden: {
      method: "PUT",
      path: "/inbox/state",
      body: SetInboxHiddenSchema,
      responses: { 200: InboxStateSchema },
      summary: "Hide or unhide one inbox item",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type InboxContract = typeof inboxContract;
