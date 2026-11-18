import type {
  MergeMethod,
  MergeProjectPrResult,
  ProjectPr,
  ProjectPrUpdateResult,
} from "@zibby/contracts";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import { PrNotMergeableError, PrUpdateRefusedError } from "./projects.errors";

type GitlabLink = { host: string; repo: string };

interface GitlabMr {
  iid?: number;
  title?: string;
  web_url?: string;
  author?: { username?: string };
  source_branch?: string;
  draft?: boolean;
  created_at?: string;
}

/** Open merge requests of a GitLab project as the wire `ProjectPr` (number = iid). */
export async function listOpenGitlabMrs(
  client: GitlabClient,
  link: { host: string; repo: string },
): Promise<ProjectPr[]> {
  const mrs =
    (await client.api<GitlabMr[] | undefined>(
      link.host,
      `${client.projectPath(link.repo)}/merge_requests?state=opened&per_page=50`,
    )) ?? [];
  const prs: ProjectPr[] = [];
  for (const mr of mrs) {
    if (mr.iid === undefined) continue;
    prs.push({
      number: mr.iid,
      title: mr.title ?? "",
      url: mr.web_url ?? "",
      ...(mr.author?.username ? { author: mr.author.username } : {}),
      ...(mr.source_branch ? { branch: mr.source_branch } : {}),
      draft: mr.draft === true,
      ...(mr.created_at ? { createdAt: new Date(mr.created_at).toISOString() } : {}),
    });
  }
  return prs;
}

interface GitlabMrState {
  iid?: number;
  web_url?: string;
  title?: string;
  state?: string;
  draft?: boolean;
  should_remove_source_branch?: boolean | null;
  force_remove_source_branch?: boolean | null;
  merge_commit_sha?: string | null;
  squash_commit_sha?: string | null;
}

const mrPath = (client: GitlabClient, link: GitlabLink, number: number) =>
  `${client.projectPath(link.repo)}/merge_requests/${number}`;

/** One MR's minimal live state (`merge_requests/:iid`); `null` when it is gone (404). */
export async function getGitlabMr(
  client: GitlabClient,
  link: GitlabLink,
  number: number,
): Promise<{ number: number; merged: boolean; state: "open" | "closed" } | null> {
  try {
    const mr = await client.api<GitlabMrState>(link.host, mrPath(client, link, number));
    return {
      number: mr?.iid ?? number,
      merged: mr?.state === "merged",
      state: mr?.state === "opened" ? "open" : "closed",
    };
  } catch (error) {
    if (error instanceof GitlabApiError && error.status === 404) return null;
    if (
      error instanceof GitlabApiError &&
      (error.status === 429 || (error.status === 403 && /rate.?limit/i.test(error.message)))
    ) {
      throw new Error(`gitlab rate limited (HTTP ${error.status})`);
    }
    throw error;
  }
}

/**
 * Operator-triggered merge (`PUT merge_requests/:iid/merge`). Same contract as the GitHub path:
 * 405/406/409/422 is a refusal (`PrNotMergeableError`). `rebase` has no merge-time equivalent on
 * GitLab (it is a project setting), so it is refused up front rather than merged differently.
 * `branchDeleted` is reported only when the response confirms the source branch is flagged for removal.
 */
export async function mergeGitlabMr(
  client: GitlabClient,
  link: GitlabLink,
  projectId: string,
  number: number,
  method: MergeMethod | undefined,
  deleteBranch: boolean,
): Promise<MergeProjectPrResult> {
  if (method === "rebase") {
    throw new PrNotMergeableError(projectId, number, "rebase merge is not available on GitLab");
  }
  const params = new URLSearchParams();
  if (method === "squash") params.set("squash", "true");
  if (deleteBranch) params.set("should_remove_source_branch", "true");
  const qs = params.size ? `?${params}` : "";
  try {
    const mr = await client.api<GitlabMrState>(
      link.host,
      `${mrPath(client, link, number)}/merge${qs}`,
      { method: "PUT" },
    );
    const sha = mr?.merge_commit_sha ?? mr?.squash_commit_sha ?? undefined;
    const merged = mr?.state === "merged";
    const removing =
      mr?.should_remove_source_branch === true || mr?.force_remove_source_branch === true;
    return {
      // ponytail: "merged" only once GitLab says so; a merge-when-pipeline-succeeds MR reports not merged yet.
      merged,
      url: mr?.web_url ?? `https://${link.host}/${link.repo}/-/merge_requests/${number}`,
      ...(sha ? { sha } : {}),
      ...(merged && deleteBranch
        ? removing
          ? { branchDeleted: true }
          : {
              branchDeleted: false,
              note: "merged, but GitLab did not confirm the source branch removal",
            }
        : {}),
    };
  } catch (error) {
    if (error instanceof GitlabApiError && [405, 406, 409, 422].includes(error.status ?? 0)) {
      throw new PrNotMergeableError(projectId, number, error.message);
    }
    throw error;
  }
}

async function readOpenMr(
  client: GitlabClient,
  link: GitlabLink,
  projectId: string,
  number: number,
): Promise<GitlabMrState> {
  try {
    return (await client.api<GitlabMrState>(link.host, mrPath(client, link, number))) ?? {};
  } catch (error) {
    if (error instanceof GitlabApiError && error.status === 404) {
      throw new PrUpdateRefusedError(projectId, number, "PR not found");
    }
    throw error;
  }
}

async function putMr(
  client: GitlabClient,
  link: GitlabLink,
  projectId: string,
  number: number,
  body: Record<string, string>,
): Promise<GitlabMrState> {
  try {
    return (
      (await client.api<GitlabMrState>(link.host, mrPath(client, link, number), {
        method: "PUT",
        body,
      })) ?? {}
    );
  } catch (error) {
    if (error instanceof GitlabApiError && [403, 404, 405, 409, 422].includes(error.status ?? 0)) {
      throw new PrUpdateRefusedError(projectId, number, error.message);
    }
    throw error;
  }
}

/** Close without merging (`PUT merge_requests/:iid` `state_event=close`); `changed` is false when already closed. */
export async function closeGitlabMr(
  client: GitlabClient,
  link: GitlabLink,
  projectId: string,
  number: number,
): Promise<{ result: ProjectPrUpdateResult; changed: boolean }> {
  const url = `https://${link.host}/${link.repo}/-/merge_requests/${number}`;
  const current = await readOpenMr(client, link, projectId, number);
  if (current.state !== "opened") {
    return {
      result: { url: current.web_url ?? url, state: "closed", draft: current.draft === true },
      changed: false,
    };
  }
  const mr = await putMr(client, link, projectId, number, { state_event: "close" });
  return {
    result: {
      url: mr.web_url ?? current.web_url ?? url,
      state: mr.state === "closed" ? "closed" : "open",
      draft: (mr.draft ?? current.draft) === true,
    },
    changed: mr.state === "closed",
  };
}

const DRAFT_PREFIX = /^\s*(?:\[draft\]|\(draft\)|draft:)\s*/i;

/** Draft toggle: the title gains/loses the `Draft: ` prefix. `changed` is false for a no-op. */
export async function setGitlabMrDraft(
  client: GitlabClient,
  link: GitlabLink,
  projectId: string,
  number: number,
  draft: boolean,
): Promise<{ result: ProjectPrUpdateResult; changed: boolean }> {
  const current = await readOpenMr(client, link, projectId, number);
  const url = current.web_url ?? `https://${link.host}/${link.repo}/-/merge_requests/${number}`;
  if (current.state !== "opened") {
    throw new PrUpdateRefusedError(projectId, number, "the PR is not open");
  }
  if ((current.draft === true) === draft) {
    return { result: { url, state: "open", draft }, changed: false };
  }
  const bare = (current.title ?? "").replace(DRAFT_PREFIX, "");
  await putMr(client, link, projectId, number, { title: draft ? `Draft: ${bare}` : bare });
  return { result: { url, state: "open", draft }, changed: true };
}
