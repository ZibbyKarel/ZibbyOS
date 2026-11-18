import type { ScheduledTask } from "@zibby/contracts";
import type { GitlabClient } from "../git-host/gitlab-client";
import {
  gitlabThreads,
  replyGitlabDiscussion,
  requestGitlabReview,
  resolveGitlabDiscussion,
} from "./inbox-pr-threads.gitlab";
import { PrRefusedError, errMsg } from "./inbox-rebase.service";
import {
  type GitlabLink,
  readGitlabDiscussions,
  readGitlabMr,
  readGitlabReviewers,
} from "./inbox.gitlab";

type Fix = NonNullable<ScheduledTask["prAddressComments"]>;

/**
 * The refs of an open, same-project MR whose source branch ZIBBY may push to (address review
 * comments; the rebase task reuses it). Refuses an unreadable or closed MR, a fork source, a
 * non-plain ref name, and a source that is the target or default branch — all as `PrRefusedError`.
 */
export async function readGitlabPushableMr(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<{ head: string; base: string; headSha: string; author: string }> {
  const ref = `${link.repo}!${iid}`;
  let mr: Awaited<ReturnType<typeof readGitlabMr>>;
  let defaultBranch: string | undefined;
  try {
    mr = await readGitlabMr(client, link, iid);
    ({ default_branch: defaultBranch } = await client.api<{ default_branch?: string }>(
      link.host,
      client.projectPath(link.repo),
    ));
  } catch (error) {
    throw new PrRefusedError(`cannot read ${ref} from GitLab (${errMsg(error)})`);
  }
  const head = mr.source_branch;
  const base = mr.target_branch;
  const headSha = mr.sha;
  if (mr.state !== "opened" || !head || !base || !headSha) {
    throw new PrRefusedError(`${ref} is not an open merge request`);
  }
  if (mr.source_project_id === undefined || mr.source_project_id !== mr.target_project_id) {
    throw new PrRefusedError(
      `${ref} comes from a fork — ZIBBY only pushes to branches of ${link.repo}`,
    );
  }
  const SAFE_REF = /^[\w./-]+$/;
  for (const name of [head, base]) {
    if (!SAFE_REF.test(name) || name.startsWith("-")) {
      throw new PrRefusedError(`refusing ${ref}: branch name "${name}" is not a plain ref`);
    }
  }
  if (head === base || head === defaultBranch) {
    throw new PrRefusedError(`refusing to rewrite "${head}" — it is the target or default branch`);
  }
  return { head, base, headSha, author: mr.author?.username ?? "" };
}

/** What `postFollowUp` records on the task. */
export interface GitlabFollowUp {
  replied?: number;
  repliesNote?: string;
  descriptionNote?: string;
  resolved: number;
  reviewersRequested: string[];
  followUpNote: string;
}

/**
 * After the push, the GitLab side of `postFollowUp`: reply on the parked discussions (only ones
 * GitLab reports unresolved right now), apply the new description, resolve the fixed ones, and
 * re-request review from the commenters and from whoever requested changes. Never throws:
 * failures are returned as notes, nothing is retried.
 */
export async function gitlabFollowUp(
  client: GitlabClient,
  link: GitlabLink,
  fix: Pick<Fix, "number" | "report" | "description">,
  replies: NonNullable<Fix["replies"]>,
  markedDone: ReadonlySet<string>,
  operatorEdited: boolean,
): Promise<GitlabFollowUp> {
  const out: GitlabFollowUp = { resolved: 0, reviewersRequested: [], followUpNote: "" };
  const posted = new Set<string>();
  let open = new Set<string>();
  if (replies.length) {
    let replied = 0;
    try {
      const threads = await gitlabThreads(client, link, fix.number);
      open = new Set(threads.filter((t) => !t.isResolved).map((t) => t.id));
      for (const r of replies.filter((x) => open.has(x.threadId) && x.body.trim())) {
        await replyGitlabDiscussion(client, link, fix.number, r.threadId, r.body);
        replied++;
        posted.add(r.threadId);
      }
      const skipped = replies.filter((r) => !open.has(r.threadId)).length;
      out.replied = replied;
      out.repliesNote = skipped ? `${skipped} skipped (not an open thread of this MR)` : "";
    } catch (error) {
      out.replied = replied;
      out.repliesNote = errMsg(error).slice(0, 300);
    }
  }

  const notes: string[] = [];
  if (fix.description) {
    try {
      await client.api(link.host, `${client.projectPath(link.repo)}/merge_requests/${fix.number}`, {
        method: "PUT",
        body: {
          ...(fix.description.title ? { title: fix.description.title } : {}),
          description: fix.description.body,
        },
      });
    } catch (error) {
      notes.push(`MR description: ${errMsg(error)}`);
      out.descriptionNote = errMsg(error).slice(0, 300);
    }
  }

  // The operator's tick wins: resolve an open thread when its reply was just posted or has
  // no body to post — a thread whose reply failed stays open.
  for (const r of replies.filter(
    (x) =>
      x.resolve &&
      (operatorEdited || markedDone.has(x.threadId)) &&
      open.has(x.threadId) &&
      (!x.body.trim() || posted.has(x.threadId)),
  )) {
    try {
      await resolveGitlabDiscussion(client, link, fix.number, r.threadId);
      out.resolved++;
    } catch (error) {
      notes.push(`resolve ${r.threadId}: ${errMsg(error)}`);
    }
  }

  try {
    const [mr, discussions, reviewers] = await Promise.all([
      readGitlabMr(client, link, fix.number),
      readGitlabDiscussions(client, link, fix.number),
      readGitlabReviewers(client, link, fix.number),
    ]);
    const author = (mr.author?.username ?? "").toLowerCase();
    // Every author of a thread this run worked on is asked to re-review, plus whoever
    // requested changes — the fixes are only done once the commenter has looked again.
    const reported = new Set(
      [...(fix.report ?? "").matchAll(/thread:\s*`?([A-Za-z0-9_-]+)`?/g)].map((m) => m[1]),
    );
    const commenters = discussions
      .filter((d) => d.id && reported.has(d.id))
      .map((d) => (d.notes ?? []).find((n) => !n.system)?.author)
      .filter((a) => a && !a.bot)
      .map((a) => a?.username);
    const requesters = reviewers
      .filter((r) => r.state === "requested_changes")
      .map((r) => r.user?.username);
    const logins = [
      ...new Map(
        [...commenters, ...requesters]
          .filter((l): l is string => !!l && l.toLowerCase() !== author)
          .map((l) => [l.toLowerCase(), l] as const),
      ).values(),
    ];
    for (const login of logins) {
      try {
        await requestGitlabReview(client, link, fix.number, login);
        out.reviewersRequested.push(login);
      } catch (error) {
        notes.push(`re-request review from ${login}: ${errMsg(error)}`);
      }
    }
  } catch (error) {
    notes.push(`re-request review: ${errMsg(error)}`);
  }
  out.followUpNote = notes.join("; ").slice(0, 300);
  return out;
}
