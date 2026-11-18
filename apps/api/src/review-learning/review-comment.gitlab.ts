import { prWebUrl } from "../git-host/git-host-url";
import type { GitlabClient } from "../git-host/gitlab-client";
import type { FetchedComment } from "./review-comment.fetcher";

interface GitlabNote {
  id?: number;
  body?: string;
  system?: boolean;
  author?: { username?: string };
  created_at?: string;
}

interface GitlabDiscussion {
  notes?: GitlabNote[];
}

/**
 * Review comments on one merge request, read from `merge_requests/:iid/discussions`: every human
 * note (system notes are activity noise), `commentId` = `dn-<noteId>`, `commentUrl` = the note's
 * anchor `…/-/merge_requests/N#note_<id>`. Newer than `cursor` only. Throws on a failed read —
 * the caller records the endpoint as failed so its cursor is held.
 */
export async function fetchGitlabMrComments(
  client: GitlabClient,
  link: { host: string; repo: string },
  number: number,
  cursor: string | undefined,
): Promise<FetchedComment[]> {
  const discussions =
    (await client.api<GitlabDiscussion[] | undefined>(
      link.host,
      `${client.projectPath(link.repo)}/merge_requests/${number}/discussions?per_page=100`,
      { paginate: true },
    )) ?? [];
  const prUrl = prWebUrl({ kind: "gitlab", ...link }, number);
  const out: FetchedComment[] = [];
  for (const discussion of discussions) {
    for (const note of discussion.notes ?? []) {
      const body = note.body?.trim();
      const author = note.author?.username;
      if (note.system || note.id === undefined || !body || !author || !note.created_at) continue;
      const at = new Date(note.created_at);
      if (Number.isNaN(at.getTime())) continue;
      const iso = at.toISOString();
      if (cursor && iso <= cursor) continue;
      out.push({
        commentId: `dn-${note.id}`,
        prNumber: number,
        prUrl,
        commentUrl: `${prUrl}#note_${note.id}`,
        author,
        at: iso,
        body,
      });
    }
  }
  return out;
}
