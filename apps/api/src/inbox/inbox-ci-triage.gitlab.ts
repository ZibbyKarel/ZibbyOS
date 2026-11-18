import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import type { GitlabLink } from "./inbox.gitlab";

/** Pipeline statuses a retry can do something for. */
const RETRYABLE = new Set(["failed", "canceled"]);

/**
 * Re-run the failed jobs of the MR's head pipeline: the newest pipeline of
 * `merge_requests/:iid/pipelines` whose sha is the triaged head, then `POST pipelines/:id/retry`.
 * Throws an `Error` naming GitLab when there is nothing to retry or any call fails — the caller
 * settles the triage as `failed` with that message, never as a re-run.
 */
export async function retryGitlabHeadPipeline(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  headSha: string,
): Promise<number> {
  try {
    const pipelines =
      (await client.api<{ id: number; sha?: string; status?: string }[] | undefined>(
        link.host,
        `${client.projectPath(link.repo)}/merge_requests/${iid}/pipelines`,
      )) ?? [];
    const head = pipelines.filter((p) => p.sha === headSha).sort((a, b) => b.id - a.id)[0];
    if (!head) throw new Error(`no GitLab pipeline of ${headSha.slice(0, 7)} to re-run`);
    if (!RETRYABLE.has(head.status ?? "")) {
      throw new Error(
        `GitLab pipeline ${head.id} is ${head.status ?? "unknown"}, nothing to re-run`,
      );
    }
    await client.api(link.host, `${client.projectPath(link.repo)}/pipelines/${head.id}/retry`, {
      method: "POST",
    });
    return head.id;
  } catch (error) {
    if (!(error instanceof GitlabApiError)) throw error;
    throw new Error(
      `GitLab pipeline re-run failed (glab: ${error.message}${error.status === 403 ? " — glab may lack permission to run pipelines" : ""})`,
    );
  }
}
