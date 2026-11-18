import { type Project, gitlabRepoFor } from "@zibby/contracts";
import type { ResolvedProjectService } from "../projects/resolved-project.service";

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
    if (!repo) continue;
    const { host, username } = integration.config;
    return { kind: "gitlab", host, repo, ...(username ? { username } : {}) };
  }
  return null;
}
