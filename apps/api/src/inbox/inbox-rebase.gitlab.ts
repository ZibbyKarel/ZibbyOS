import type { GitlabClient } from "../git-host/gitlab-client";
import { readGitlabPushableMr } from "./inbox-address-comments.gitlab";
import { PrRefusedError } from "./inbox-rebase.service";
import { type GitlabLink, readGitlabMr } from "./inbox.gitlab";

/** The rebase poll: this many reads, `REBASE_POLL_MS` apart (the delay is injectable for tests). */
export const REBASE_POLL_TRIES = 10;
export const REBASE_POLL_MS = 2000;

export type Delay = (ms: number) => Promise<void>;
export const realDelay: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `readPushablePr` for a GitLab MR: the pushable refs (`readGitlabPushableMr`, same guards) plus
 * `mergeable` = `has_conflicts` read from the MR (null when GitLab does not say). An MR GitLab
 * reports 0 commits behind its target is refused up front: there is nothing to update, and a
 * server-side rebase of it would end on the same sha (where a stale `merge_error` reads as failure).
 */
export async function readGitlabRebaseRefs(client: GitlabClient, link: GitlabLink, iid: number) {
  const refs = await readGitlabPushableMr(client, link, iid);
  const mr = await readGitlabMr(client, link, iid);
  if (mr.diverged_commits_count === 0) {
    throw new PrRefusedError(`${link.repo}!${iid} is already up to date with its target branch`);
  }
  const mergeable = mr.has_conflicts === undefined ? null : !mr.has_conflicts;
  return { ...refs, mergeable };
}

/**
 * GitLab's server-side rebase: `PUT merge_requests/:iid/rebase`, then poll the MR until
 * `rebase_in_progress` is false. A new head sha means it worked (a `merge_error` left by an earlier
 * failed rebase is stale then); on the unchanged `headSha` a `merge_error` is a failure carrying
 * GitLab's message, and a missing `rebase_in_progress` field is not "done". A rebase still running
 * after the bounded poll is a failure too. A failed PUT or read propagates (`GitlabApiError`).
 */
export async function rebaseGitlabMr(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  headSha: string,
  delay: Delay = realDelay,
): Promise<void> {
  const ref = `${link.repo}!${iid}`;
  const mrPath = `${client.projectPath(link.repo)}/merge_requests/${iid}`;
  await client.api(link.host, `${mrPath}/rebase`, { method: "PUT" });
  for (let attempt = 1; attempt <= REBASE_POLL_TRIES; attempt++) {
    const mr = await client.api<{
      sha?: string;
      rebase_in_progress?: boolean;
      merge_error?: string | null;
    }>(link.host, `${mrPath}?include_rebase_in_progress=true`);
    if (mr.sha && mr.sha !== headSha) return;
    if (mr.rebase_in_progress === false) {
      if (mr.merge_error) {
        throw new PrRefusedError(`GitLab could not rebase ${ref}: ${mr.merge_error}`);
      }
      return;
    }
    if (attempt < REBASE_POLL_TRIES) await delay(REBASE_POLL_MS);
  }
  throw new PrRefusedError(
    `GitLab is still rebasing ${ref} after ${(REBASE_POLL_TRIES * REBASE_POLL_MS) / 1000} s — check the merge request`,
  );
}
