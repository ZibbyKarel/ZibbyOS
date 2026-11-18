import { Injectable, Optional } from "@nestjs/common";
import type { InboxPrDiff } from "@zibby/contracts";
import { MAX_DIFF_BYTES, capUnifiedDiff } from "../shared/cap-unified-diff";
import { resolveGitHostLink } from "../git-host/git-host-link";
import { GitlabClient } from "../git-host/gitlab-client";
import { CredentialsStore } from "../integrations/credentials.store";
import { readGitlabMrDiff } from "./inbox-pr-diff.gitlab";
import { NoGithubLinkError } from "../projects/projects.errors";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { ResolvedProjectService } from "../projects/resolved-project.service";

const GITHUB_API = "https://api.github.com";

export { MAX_DIFF_BYTES };

const GITHUB_TIMEOUT_MS = 15_000;

/** GitHub answered the diff request with an unexpected status; `status` is the upstream one. */
export class GithubDiffError extends Error {
  constructor(
    public readonly status: number,
    repo: string,
    number: number,
  ) {
    super(`GitHub diff for ${repo}#${number} failed: ${status}`);
    this.name = "GithubDiffError";
  }
}

/** Reads one PR's unified diff for the Pull Requests page detail pane. Read-only (Tier 1). */
@Injectable()
export class InboxPrDiffService {
  private readonly fetchImpl: typeof fetch;
  private readonly gitlab: GitlabClient;

  constructor(
    private readonly projects: ProjectsStorageService,
    private readonly resolvedProjects: ResolvedProjectService,
    private readonly credentials: CredentialsStore,
    @Optional() fetchImpl?: typeof fetch,
    @Optional() gitlabClient?: GitlabClient,
  ) {
    this.fetchImpl = fetchImpl ?? fetch;
    this.gitlab = gitlabClient ?? new GitlabClient();
  }

  async getDiff(projectId: string, number: number): Promise<InboxPrDiff> {
    const project = await this.projects.get(projectId); // ProjectNotFoundError → 404
    const host = await resolveGitHostLink(this.resolvedProjects, this.credentials, project);
    if (!host) throw new NoGithubLinkError(project.id);
    if (host.kind === "gitlab") return readGitlabMrDiff(this.gitlab, host, number);
    const link = host;
    const res = await this.fetchImpl(`${GITHUB_API}/repos/${link.repo}/pulls/${number}`, {
      headers: {
        accept: "application/vnd.github.diff",
        authorization: `Bearer ${link.token}`,
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
    if (res.status === 406) return { diff: "", truncated: true };
    if (!res.ok) throw new GithubDiffError(res.status, link.repo, number);
    const text = await res.text();
    return capUnifiedDiff(text);
  }
}
