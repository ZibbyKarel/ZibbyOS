import type { ProjectPr } from "@zibby/contracts";
import type { GitlabClient } from "../git-host/gitlab-client";

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
