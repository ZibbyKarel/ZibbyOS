import type { Project } from "@zibby/contracts";
import type { CredentialsStore } from "../integrations/credentials.store";
import { resolveGithubToken } from "../projects/project-pr.service";
import type { ResolvedProjectService } from "../projects/resolved-project.service";
import { resolveGitlabLink } from "./gitlab-link";

/** Where a project's code lives: GitHub (PAT) or GitLab (via the `glab` CLI, no token). */
export type GitHostLink =
  | { kind: "github"; repo: string; token: string; username?: string }
  | { kind: "gitlab"; host: string; repo: string; username?: string }; // repo = full path "group/sub/name"

/**
 * The project's git host: a gitlab integration with a resolvable repo wins, else the
 * existing github token resolution (unchanged). `null` when neither is configured.
 */
export async function resolveGitHostLink(
  resolvedProjects: ResolvedProjectService,
  credentials: CredentialsStore,
  project: Project,
): Promise<GitHostLink | null> {
  const gitlab = await resolveGitlabLink(resolvedProjects, project);
  if (gitlab) return gitlab;
  const github = await resolveGithubToken(resolvedProjects, credentials, project);
  return github ? { kind: "github", ...github } : null;
}
