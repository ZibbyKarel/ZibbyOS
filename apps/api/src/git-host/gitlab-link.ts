import { type Project, gitlabRepoFor } from "@zibby/contracts";
import type { ResolvedProjectService } from "../projects/resolved-project.service";

const REPO_SHAPE = /^[\w.-]+(\/[\w.-]+)+$/;
const HOST_SHAPE = /^[a-z0-9.-]+(:\d+)?$/i;

/** A project's GitLab link: `repo` = full path "group/sub/name". */
export type GitlabLink = { kind: "gitlab"; host: string; repo: string; username?: string };

/**
 * The GitLab half of `resolveGitHostLink` — needs no credentials store (glab holds the auth).
 * A leaf file on purpose: task output / the workflow runner import it, and pulling in
 * `git-host-link` would drag `project-pr.service` into a module-load cycle with the task scheduler.
 */
export async function resolveGitlabLink(
  resolvedProjects: ResolvedProjectService,
  project: Project,
): Promise<GitlabLink | null> {
  const integrations = await resolvedProjects.resolveIntegrations(project);
  for (const integration of integrations) {
    if (integration.config.kind !== "gitlab") continue;
    const repo = gitlabRepoFor(integration, project);
    const { host, username } = integration.config;
    // The path ends up in prompts and `-R` arguments; checks on write are not enough (files can be edited).
    if (!repo || !REPO_SHAPE.test(repo) || !HOST_SHAPE.test(host)) continue;
    return { kind: "gitlab", host, repo, ...(username ? { username } : {}) };
  }
  return null;
}
