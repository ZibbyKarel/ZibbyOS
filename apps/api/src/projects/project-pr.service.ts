import { Inject, Injectable, Optional, forwardRef } from "@nestjs/common";
import {
  type CredentialsInput,
  type MergeMethod,
  type MergeProjectPrResult,
  type Project,
  type ProjectPr,
  type ProjectPrUpdateResult,
  githubRepoFor,
} from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { resolveGitHostLink } from "../git-host/git-host-link";
import { GitlabClient } from "../git-host/gitlab-client";
import { CredentialsStore } from "../integrations/credentials.store";
// 125e — the roadmap gate's eager merge signal (see `recordMerge` below). This
// closes a genuine circular provider dependency with `RoadmapGateService`
// (RoadmapModule already depends on ProjectsModule for `ProjectsStorageService`
// and the classes reach into each other), resolved with `forwardRef` on both the
// module registration (`projects.module.ts` <-> `roadmap.module.ts`) and this
// constructor injection, exactly like the pre-existing `ResolvedProjectModule` <->
// `IntegrationsModule` <-> `ProjectsModule` triangle.
import { RoadmapGateService } from "../roadmap/roadmap-gate.service";
import {
  closeGitlabMr,
  getGitlabMr,
  listOpenGitlabMrs,
  mergeGitlabMr,
  setGitlabMrDraft,
} from "./project-pr.gitlab";
import { NoGithubLinkError, PrNotMergeableError, PrUpdateRefusedError } from "./projects.errors";
import { ProjectsStorageService } from "./projects.storage.service";
import { ResolvedProjectService } from "./resolved-project.service";

const GITHUB_API = "https://api.github.com";

/** Bounds the open-PRs listing call — this feeds the Release merge queue and
 *  the briefing/`get_status` chat tool, so a stalled request must not hang it. */
const LIST_OPEN_TIMEOUT_MS = 8_000;

interface GitHubPull {
  number?: number;
  title?: string;
  html_url?: string;
  user?: { login?: string };
  head?: { ref?: string };
  draft?: boolean;
  created_at?: string;
}

/**
 * goals-mandates — one PR's live merge preconditions, read for the goal merge grant. Every
 * field is fail-closed: `ci` is `green` only when every check and status finished successfully
 * (no checks at all = `none`), `approvedShas` holds the commit each reviewer's latest approval
 * was given on.
 */
export interface PrMergeState {
  repo: string;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  headSha: string;
  /** GitHub's `mergeable`; `null` = not computed yet (unknown). */
  mergeable: boolean | null;
  /** The commit ids of the reviewers' latest reviews that are approvals (dismissed ones dropped). */
  approvedShas: string[];
  /** Some reviewer's latest review requests changes. */
  changesRequested: boolean;
  ci: "green" | "pending" | "red" | "none";
}

/** Check-run conclusions that count as green (anything else finished = red). */
const GREEN_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
/** Page size of the review / check reads; a full page fails closed (it could be truncated). */
const STATE_PAGE = 100;

/** PAT from the closed credentials union (null if absent) — same shape as the CI monitor. */
function tokenOf(creds: CredentialsInput): string | null {
  return "token" in creds ? creds.token : null;
}

/**
 * NS2 F5a/F5b — the project's effective github integration's repo + stored
 * token, or `null`. Extracted out of {@link ProjectPrService}'s private
 * `resolveGithubLink` so `SecurityService` and `ReleaseService` reach the
 * exact same token-resolution seam (company-merged integrations,
 * `CredentialsStore` read, `tokenOf` narrowing) without duplicating it.
 * `ProjectPrService` itself delegates to this function below.
 */
export async function resolveGithubToken(
  resolvedProjects: ResolvedProjectService,
  credentials: CredentialsStore,
  project: Project,
): Promise<{ repo: string; token: string; username?: string } | null> {
  const integrations = await resolvedProjects.resolveIntegrations(project);
  const github = integrations.find((integration) => integration.config.kind === "github");
  if (!github) return null;
  // Phase 129 (G2): a company-owned integration takes the repo from the project's gitRemote.
  const repo = githubRepoFor(github, project);
  if (!repo) return null;
  const creds = await credentials.read(github.id);
  const token = creds ? tokenOf(creds) : null;
  if (!token) return null;
  const username = github.config.kind === "github" ? github.config.username : undefined;
  return { repo, token, ...(username ? { username } : {}) };
}

/** Map one GitHub `pulls` list entry to the wire `ProjectPr` shape; `null` for a malformed entry. */
function toProjectPr(pull: GitHubPull): ProjectPr | null {
  if (pull.number === undefined) return null;
  return {
    number: pull.number,
    title: pull.title ?? "",
    url: pull.html_url ?? "",
    ...(pull.user?.login ? { author: pull.user.login } : {}),
    ...(pull.head?.ref ? { branch: pull.head.ref } : {}),
    draft: pull.draft === true,
    ...(pull.created_at ? { createdAt: new Date(pull.created_at).toISOString() } : {}),
  };
}

/**
 * Phase 78 — the open-PR overview and operator-triggered merge for a project's
 * linked GitHub repo. Reuses the CI monitor's GitHub-REST posture exactly:
 * `Bearer <token>`, rate-limit handling on 429/403, an injectable `fetchImpl`
 * for tests (`@github-ci.monitor.ts` is the reference).
 *
 * `listOpen` resolves the project's EFFECTIVE (company-merged) integrations —
 * same seam `ResolvedProjectService` already gives every other project reader —
 * and never errors on a missing link: no github integration, or an integration
 * with no stored token, both read as "nothing to show" (`[]`), never an error
 * page (the Phase 78 plan's "Data source" section). `merge` is the opposite:
 * an explicit operator click needs a real answer, so a missing link there is a
 * 422, not a silent no-op.
 */
@Injectable()
export class ProjectPrService {
  private readonly fetchImpl: typeof fetch;
  private readonly gitlab: GitlabClient;
  /** Phase 129 P3 — PR change listeners (the PR inbox drops its cache); registered at startup. */
  private readonly changedListeners: ((repo: string, number: number) => void)[] = [];

  constructor(
    private readonly projects: ProjectsStorageService,
    private readonly resolvedProjects: ResolvedProjectService,
    private readonly credentials: CredentialsStore,
    private readonly activity: ActivityLogService,
    // 125e — see the import comment above for why this needs `forwardRef`.
    @Inject(forwardRef(() => RoadmapGateService)) private readonly roadmapGate: RoadmapGateService,
    // Optional so Nest doesn't try to DI-resolve a plain function type —
    // production defaults to the global `fetch`; tests inject a stub (mirrors
    // `JiraIssueFlowService`'s `@Optional() adapter?` seam).
    @Optional() fetchImpl?: typeof fetch,
    @Optional() gitlab?: GitlabClient,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
    this.gitlab = gitlab ?? new GitlabClient();
  }

  /** Register a callback fired after every successful merge / close / draft toggle (no module cycle). */
  onPrChanged(listener: (repo: string, number: number) => void): void {
    this.changedListeners.push(listener);
  }

  private notifyChanged(repo: string, number: number): void {
    for (const listener of this.changedListeners) {
      try {
        listener(repo, number);
      } catch {
        // a listener failure must never surface as a failure of the change itself
      }
    }
  }

  /** The project's effective github integration's repo + stored token, or `null`. */
  private async resolveGithubLink(
    project: Project,
  ): Promise<{ repo: string; token: string } | null> {
    return resolveGithubToken(this.resolvedProjects, this.credentials, project);
  }

  /**
   * Open PRs for the project's linked repo (`GET /repos/{repo}/pulls?state=open`),
   * newest per GitHub's default order. `[]` when the project has no github link/
   * token — never an error. A hard GitHub failure (rate limit, non-2xx) still
   * throws, same as the CI monitor: a real upstream failure is not silently
   * swallowed into an empty list.
   */
  async listOpen(projectId: string): Promise<ProjectPr[]> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const link = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    if (link?.kind === "gitlab") return listOpenGitlabMrs(this.gitlab, link);
    if (!link) return [];

    const res = await this.fetchImpl(
      `${GITHUB_API}/repos/${link.repo}/pulls?state=open&per_page=50`,
      {
        headers: { authorization: `Bearer ${link.token}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(LIST_OPEN_TIMEOUT_MS),
      },
    );
    if (res.status === 429 || res.status === 403) {
      throw new Error(`github rate limited (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(`github pulls: HTTP ${res.status}`);
    const body = (await res.json()) as unknown;
    const pulls = Array.isArray(body) ? (body as GitHubPull[]) : [];

    const prs: ProjectPr[] = [];
    for (const pull of pulls) {
      const pr = toProjectPr(pull);
      if (pr) prs.push(pr);
    }
    return prs;
  }

  /**
   * One PR's minimal live state (`GET /repos/{repo}/pulls/{number}`) — the roadmap
   * gate's merge-state poll (125e), reading every `awaiting-merge` item's PR. Mirrors
   * `listOpen`'s error posture exactly: 404 → `null` (PR/repo gone), 429/403 → throws
   * "github rate limited", any other non-2xx → throws, no github link → `null`.
   */
  async getPr(
    projectId: string,
    number: number,
  ): Promise<{ number: number; merged: boolean; state: "open" | "closed" } | null> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const host = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    if (host?.kind === "gitlab") return getGitlabMr(this.gitlab, host, number);
    const link = await this.resolveGithubLink(project);
    if (!link) return null;

    const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
      headers: { authorization: `Bearer ${link.token}`, accept: "application/vnd.github+json" },
    });
    if (res.status === 404) return null;
    if (res.status === 429 || res.status === 403) {
      throw new Error(`github rate limited (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(`github pull #${number}: HTTP ${res.status}`);
    const body = (await res.json()) as { number?: number; merged?: boolean; state?: string };
    return {
      number: body.number ?? number,
      merged: body.merged === true,
      state: body.state === "closed" ? "closed" : "open",
    };
  }

  /**
   * Fail-CLOSED: unknown/gone/no-link/rate-limited → `false`. A dependency GATE must
   * never release a downstream roadmap item on an unreadable PR state — the opposite
   * of a fail-open posture, which is fine for a status read but not for gating a
   * fresh dispatch.
   */
  async isMerged(projectId: string, number: number): Promise<boolean> {
    try {
      const pr = await this.getPr(projectId, number);
      return pr?.merged === true;
    } catch {
      return false;
    }
  }

  /**
   * goals-mandates — one GitHub PR's live merge preconditions (pull, reviews, check runs and
   * commit statuses of the head), read fresh for the goal merge grant. Returns `null` for a
   * GitLab project (a review's commit is not read there, so the grant fails closed) or one with
   * no GitHub link. Throws on any failed or possibly truncated read — never guesses.
   */
  async mergeState(projectId: string, number: number): Promise<PrMergeState | null> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const host = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    if (host?.kind === "gitlab") return null;
    const link = await this.resolveGithubLink(project);
    if (!link) return null;
    const get = async <T>(path: string): Promise<T> => {
      const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}${path}`, {
        headers: { authorization: `Bearer ${link.token}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(LIST_OPEN_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`github ${path}: HTTP ${res.status}`);
      return (await res.json()) as T;
    };
    const pull = await get<{
      state?: string;
      merged?: boolean;
      draft?: boolean;
      mergeable?: boolean | null;
      head?: { sha?: string };
    }>(`/pulls/${number}`);
    const headSha = pull.head?.sha;
    if (!headSha) throw new Error(`github pull #${number}: no head sha`);
    const [reviews, checks, status] = await Promise.all([
      get<{ state?: string; commit_id?: string; user?: { login?: string } }[]>(
        `/pulls/${number}/reviews?per_page=${STATE_PAGE}`,
      ),
      get<{ total_count?: number; check_runs?: { status?: string; conclusion?: string | null }[] }>(
        `/commits/${headSha}/check-runs?per_page=${STATE_PAGE}`,
      ),
      get<{ statuses?: { state?: string }[] }>(`/commits/${headSha}/status?per_page=${STATE_PAGE}`),
    ]);
    const runs = checks.check_runs ?? [];
    const statuses = status.statuses ?? [];
    if (
      !Array.isArray(reviews) ||
      reviews.length >= STATE_PAGE ||
      (checks.total_count ?? 0) > runs.length ||
      statuses.length >= STATE_PAGE
    ) {
      throw new Error(`github pull #${number}: reviews or checks may be truncated`);
    }
    // Reviews come oldest first; a reviewer's latest approve / request-changes / dismiss counts.
    const latest = new Map<string, { state: string; commitId?: string }>();
    for (const r of reviews) {
      const login = r.user?.login;
      if (!login || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state ?? "")) {
        continue;
      }
      latest.set(login, { state: r.state ?? "", commitId: r.commit_id });
    }
    const current = [...latest.values()];
    const ci: PrMergeState["ci"] =
      runs.some((r) => r.status !== "completed") || statuses.some((x) => x.state === "pending")
        ? "pending"
        : runs.some((r) => !GREEN_CONCLUSIONS.has(r.conclusion ?? "")) ||
            statuses.some((x) => x.state !== "success")
          ? "red"
          : runs.length + statuses.length === 0
            ? "none"
            : "green";
    return {
      repo: link.repo,
      state: pull.state === "open" ? "open" : "closed",
      merged: pull.merged === true,
      draft: pull.draft === true,
      headSha,
      mergeable: typeof pull.mergeable === "boolean" ? pull.mergeable : null,
      approvedShas: current.flatMap((r) =>
        r.state === "APPROVED" && r.commitId ? [r.commitId] : [],
      ),
      changesRequested: current.some((r) => r.state === "CHANGES_REQUESTED"),
      ci,
    };
  }

  /**
   * Merge one open PR (`PUT /repos/{repo}/pulls/{number}/merge`).
   *
   * **This method is the ONLY merge path in ZIBBY.** It is reached from the operator-triggered
   * `POST /projects/:id/prs/:number/merge` controller route below, and from exactly one
   * autonomous caller: the goal engine's `merge` action (`goals/goal-merge.service.ts`), which
   * runs only under an operator-set, token-protected, time-boxed merge grant (Law 3 exception,
   * `docs/api/goals.md`) after re-reading every precondition with {@link mergeState} and passes
   * `sha` so GitHub refuses the merge if the head moved meanwhile. No other scheduler, monitor
   * or runner may call it.
   */
  async merge(
    projectId: string,
    number: number,
    method?: MergeMethod,
    deleteBranch = false,
    /** GitHub only: the head SHA the PR must still have, else GitHub refuses (409). */
    sha?: string,
  ): Promise<MergeProjectPrResult> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const host = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    if (host?.kind === "gitlab") {
      // The head pin is GitHub-only here: a pinned merge never goes through unpinned.
      if (sha)
        throw new PrNotMergeableError(projectId, number, "head SHA pin unsupported on GitLab");
      const result = await mergeGitlabMr(
        this.gitlab,
        host,
        projectId,
        number,
        method,
        deleteBranch,
      );
      if (result.merged) {
        await this.recordMerge(projectId, host.repo, number, result.sha).catch(() => {});
        this.notifyChanged(host.repo, number);
      }
      return result;
    }
    const link = await this.resolveGithubLink(project);
    if (!link) throw new NoGithubLinkError(projectId);

    const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}/merge`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${link.token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...(method ? { merge_method: method } : {}),
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.status === 405 || res.status === 409) {
      const detail = await res
        .json()
        .then((b: { message?: string }) => b.message)
        .catch(() => undefined);
      throw new PrNotMergeableError(projectId, number, detail);
    }
    if (!res.ok) throw new Error(`github merge PR #${number}: HTTP ${res.status}`);
    const body = (await res.json()) as { merged?: boolean; sha?: string };
    const merged = body.merged === true;

    if (merged) {
      // Record the merge (activity + roadmap gate). Merging
      // itself is unconditional and un-gated by this: a recording failure must
      // NEVER surface as a merge failure (the merge already happened on GitHub).
      await this.recordMerge(projectId, link.repo, number, body.sha).catch(() => {});
      this.notifyChanged(link.repo, number);
    }
    const cleanup = merged && deleteBranch ? await this.deleteHeadBranch(link, number) : {};

    return {
      merged,
      url: `https://github.com/${link.repo}/pull/${number}`,
      ...(body.sha ? { sha: body.sha } : {}),
      ...cleanup,
    };
  }

  /**
   * todo-15 — close an open PR without merging (`PATCH /repos/{repo}/pulls/{number}`).
   * Like `merge`, reached ONLY from the operator-triggered controller route (the UI confirms
   * first) and denied to the chat self-API; no scheduler, monitor or runner calls it.
   */
  async close(projectId: string, number: number): Promise<ProjectPrUpdateResult> {
    const gl = await this.gitlabLink(projectId);
    if (gl) {
      const { result, changed } = await closeGitlabMr(this.gitlab, gl, projectId, number);
      if (changed) {
        void this.activity.record({
          kind: "pr-closed",
          summary: `Closed PR #${number} in ${gl.repo} without merging`,
          refs: { projectId, itemId: `pr-${number}` },
        });
        this.notifyChanged(gl.repo, number);
      }
      return result;
    }
    const link = await this.requireLink(projectId);
    const headers = this.ghHeaders(link.token);
    const read = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
      headers,
    });
    if (read.status === 404) throw new PrUpdateRefusedError(projectId, number, "PR not found");
    if (!read.ok) throw new Error(`github read PR #${number}: HTTP ${read.status}`);
    const current = (await read.json()) as { state?: string; draft?: boolean; html_url?: string };
    // Already closed (or merged): nothing to do, nothing to record.
    if (current.state !== "open") {
      return {
        url: current.html_url ?? `https://github.com/${link.repo}/pull/${number}`,
        state: "closed",
        draft: current.draft === true,
      };
    }
    const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ state: "closed" }),
    });
    if ([403, 404, 409, 422].includes(res.status)) {
      throw new PrUpdateRefusedError(projectId, number, await ghMessage(res));
    }
    if (!res.ok) throw new Error(`github close PR #${number}: HTTP ${res.status}`);
    const pull = (await res.json()) as { state?: string; draft?: boolean; html_url?: string };
    void this.activity.record({
      kind: "pr-closed",
      summary: `Closed PR #${number} in ${link.repo} without merging`,
      refs: { projectId, itemId: `pr-${number}` },
    });
    this.notifyChanged(link.repo, number);
    return {
      url: pull.html_url ?? `https://github.com/${link.repo}/pull/${number}`,
      state: pull.state === "open" ? "open" : "closed",
      draft: pull.draft === true,
    };
  }

  /**
   * todo-15 — convert a PR to draft (`draft: true`) or mark it ready for review. GitHub's REST
   * API cannot do either, so this reads the PR's `node_id` and runs the GraphQL
   * `convertPullRequestToDraft` / `markPullRequestReadyForReview` mutation. Operator-only, same
   * guard as `close`. A PR already in the requested state is a no-op.
   */
  async setDraft(
    projectId: string,
    number: number,
    draft: boolean,
  ): Promise<ProjectPrUpdateResult> {
    const gl = await this.gitlabLink(projectId);
    if (gl) {
      const { result, changed } = await setGitlabMrDraft(this.gitlab, gl, projectId, number, draft);
      if (changed) {
        void this.activity.record({
          kind: "pr-draft-changed",
          summary: draft
            ? `Converted PR #${number} in ${gl.repo} to draft`
            : `Marked PR #${number} in ${gl.repo} ready for review`,
          refs: { projectId, itemId: `pr-${number}` },
        });
        this.notifyChanged(gl.repo, number);
      }
      return result;
    }
    const link = await this.requireLink(projectId);
    const headers = this.ghHeaders(link.token);
    const read = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
      headers,
    });
    if (read.status === 404) throw new PrUpdateRefusedError(projectId, number, "PR not found");
    if (!read.ok) throw new Error(`github read PR #${number}: HTTP ${read.status}`);
    const pull = (await read.json()) as {
      node_id?: string;
      state?: string;
      draft?: boolean;
      html_url?: string;
    };
    const url = pull.html_url ?? `https://github.com/${link.repo}/pull/${number}`;
    if (pull.state !== "open")
      throw new PrUpdateRefusedError(projectId, number, "the PR is not open");
    if ((pull.draft === true) === draft) return { url, state: "open", draft };
    if (!pull.node_id) throw new Error(`github read PR #${number}: no node_id`);

    const mutation = draft ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";
    const res = await this.fetchImpl(`${GITHUB_API}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `mutation($id: ID!) { ${mutation}(input: { pullRequestId: $id }) { pullRequest { isDraft } } }`,
        variables: { id: pull.node_id },
      }),
    });
    if (!res.ok) throw new Error(`github ${mutation} PR #${number}: HTTP ${res.status}`);
    const body = (await res.json()) as { errors?: { message?: string }[] };
    if (body.errors?.length) {
      throw new PrUpdateRefusedError(projectId, number, body.errors[0]?.message);
    }
    void this.activity.record({
      kind: "pr-draft-changed",
      summary: draft
        ? `Converted PR #${number} in ${link.repo} to draft`
        : `Marked PR #${number} in ${link.repo} ready for review`,
      refs: { projectId, itemId: `pr-${number}` },
    });
    this.notifyChanged(link.repo, number);
    return { url, state: "open", draft };
  }

  /** The project's GitLab link, or `null` (a project has one host: GitLab wins, the GitHub path is then skipped). */
  private async gitlabLink(projectId: string): Promise<{ host: string; repo: string } | null> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const link = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    return link?.kind === "gitlab" ? link : null;
  }

  private async requireLink(projectId: string): Promise<{ repo: string; token: string }> {
    const project = await this.projects.get(projectId); // 404 before anything else
    const link = await this.resolveGithubLink(project);
    if (!link) throw new NoGithubLinkError(projectId);
    return link;
  }

  private ghHeaders(token: string): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    };
  }

  /**
   * Phase 129 P3 — delete a merged PR's head branch
   * (`DELETE /repos/{repo}/git/refs/heads/{branch}`). Skipped for a fork (head repo ≠
   * base repo — not ours to delete). Never throws: the merge already happened, so a
   * failed lookup/delete only comes back as a `note`.
   */
  private async deleteHeadBranch(
    link: { repo: string; token: string },
    number: number,
  ): Promise<Pick<MergeProjectPrResult, "branchDeleted" | "note">> {
    const headers = {
      authorization: `Bearer ${link.token}`,
      accept: "application/vnd.github+json",
    };
    try {
      const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} reading the PR`);
      const pull = (await res.json()) as {
        head?: { ref?: string; repo?: { full_name?: string } | null };
        base?: { repo?: { full_name?: string } | null };
      };
      const branch = pull.head?.ref;
      const headRepo = pull.head?.repo?.full_name?.toLowerCase();
      const baseRepo = (pull.base?.repo?.full_name ?? link.repo).toLowerCase();
      if (!branch) throw new Error("PR has no head branch");
      if (headRepo !== baseRepo) {
        return { branchDeleted: false, note: "head branch is on a fork — not deleted" };
      }
      const del = await this.fetchImpl(
        `${GITHUB_API}/repos/${link.repo}/git/refs/heads/${branch.split("/").map(encodeURIComponent).join("/")}`,
        { method: "DELETE", headers },
      );
      // 422 = the ref is already gone (e.g. the repo auto-deletes head branches).
      if (!del.ok && del.status !== 422) throw new Error(`HTTP ${del.status} deleting ${branch}`);
      return { branchDeleted: true };
    } catch (error) {
      return {
        branchDeleted: false,
        note: `merged, but the branch was not deleted: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Record a completed merge: the `merge-completed` activity entry plus the
   * roadmap gate's eager release signal.
   */
  private async recordMerge(
    projectId: string,
    repo: string,
    number: number,
    sha: string | undefined,
  ): Promise<void> {
    void this.activity.record({
      kind: "merge-completed",
      summary: sha
        ? `Merged PR #${number} in ${repo} (${sha.slice(0, 7)})`
        : `Merged PR #${number} in ${repo}`,
      refs: { projectId, itemId: `pr-${number}` },
    });
    // 125e — the roadmap gate's EAGER release signal: an item `awaiting-merge` on
    // this exact PR becomes `done` and its project's enqueued items drain.
    // Deliberately UNAWAITED (fire-and-forget, per the master plan's "Release
    // signals") — the operator's merge response must never wait on roadmap
    // bookkeeping — and independently `.catch`ed here (not just relying on this
    // method's own caller wrapping it in `.catch(() => {})`): an unawaited rejection
    // is invisible to that outer catch and would otherwise surface as an unhandled
    // rejection. Either way, a roadmap bookkeeping failure must NEVER surface as a
    // merge failure — the merge already happened on GitHub.
    void this.roadmapGate.onMerge(projectId, number).catch(() => {});
  }
}

/** GitHub's error `message`, or undefined when the body is not JSON. */
async function ghMessage(res: Response): Promise<string | undefined> {
  return res
    .json()
    .then((b: { message?: string }) => b.message)
    .catch(() => undefined);
}
