import type { InboxPrDiff } from "@zibby/contracts";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import { capUnifiedDiff } from "../shared/cap-unified-diff";
import type { GitlabLink } from "./inbox.gitlab";

/** One file of `merge_requests/:iid/diffs`. */
export interface GitlabMrDiffFile {
  old_path?: string;
  new_path?: string;
  a_mode?: string;
  b_mode?: string;
  new_file?: boolean;
  renamed_file?: boolean;
  deleted_file?: boolean;
  /** GitLab left the patch out: too large or collapsed. */
  too_large?: boolean;
  collapsed?: boolean;
  diff?: string;
}

/** The MR's changed files with their patches. ponytail: paginates everything, capped only after composing. */
export async function readGitlabMrDiffs(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<GitlabMrDiffFile[]> {
  return (
    (await client.api<GitlabMrDiffFile[] | undefined>(
      link.host,
      `${client.projectPath(link.repo)}/merge_requests/${iid}/diffs?per_page=100`,
      { paginate: true },
    )) ?? []
  );
}

/** `git diff` text for one file: header, mode/rename lines, `---`/`+++`, then GitLab's hunks. */
function fileAsUnifiedDiff(f: GitlabMrDiffFile): string {
  const oldPath = f.old_path ?? f.new_path ?? "";
  const newPath = f.new_path ?? f.old_path ?? "";
  const lines = [`diff --git a/${oldPath} b/${newPath}`];
  if (f.new_file) lines.push(`new file mode ${f.b_mode ?? "100644"}`);
  if (f.deleted_file) lines.push(`deleted file mode ${f.a_mode ?? "100644"}`);
  if (f.renamed_file) lines.push(`rename from ${oldPath}`, `rename to ${newPath}`);
  if (f.diff) {
    lines.push(
      f.new_file ? "--- /dev/null" : `--- a/${oldPath}`,
      f.deleted_file ? "+++ /dev/null" : `+++ b/${newPath}`,
    );
    return `${lines.join("\n")}\n${f.diff.endsWith("\n") ? f.diff : `${f.diff}\n`}`;
  }
  return `${lines.join("\n")}\n`;
}

/** Composes a unified diff from the per-file patches. */
export function composeGitlabDiff(files: readonly GitlabMrDiffFile[]): InboxPrDiff {
  const capped = capUnifiedDiff(files.map(fileAsUnifiedDiff).join(""));
  // A file whose patch GitLab withheld is missing from the text — say so, as GitHub's 406 does.
  const withheld = files.some((f) => f.too_large || f.collapsed);
  return { diff: capped.diff, truncated: capped.truncated || withheld };
}

/**
 * The MR's unified diff: `raw_diffs` (GitLab 16.2+), else composed from `diffs`. Only a 404 on
 * `raw_diffs` (older GitLab) falls back; the `diffs` read then surfaces a genuinely missing MR.
 */
export async function readGitlabMrDiff(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<InboxPrDiff> {
  try {
    return capUnifiedDiff(
      await client.raw(
        link.host,
        `${client.projectPath(link.repo)}/merge_requests/${iid}/raw_diffs`,
      ),
    );
  } catch (error) {
    if (!(error instanceof GitlabApiError) || error.status !== 404) throw error;
  }
  return composeGitlabDiff(await readGitlabMrDiffs(client, link, iid));
}
