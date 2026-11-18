import type { PrReviewEvent } from "@zibby/contracts";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import { readGitlabMrDiffs } from "./inbox-pr-diff.gitlab";
import {
  type GitlabApprovals,
  type GitlabLink,
  readGitlabApprovals,
  readGitlabMr,
  readGitlabViewer,
  unavailable,
} from "./inbox.gitlab";
import { type PrReviewInlineComment, foldComments } from "./pr-review-doc";
import type { PrFileChange } from "./select-review-level";

const SHA = /^[0-9a-f]{40}$/;
const mrPath = (client: GitlabClient, link: GitlabLink, iid: number) =>
  `${client.projectPath(link.repo)}/merge_requests/${iid}`;

/** The MR head the review pins to and the target branch whose CODEOWNERS scopes it. Read failures propagate. */
export async function readGitlabReviewPin(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<{ headSha?: string; baseRef?: string }> {
  const mr = await readGitlabMr(client, link, iid);
  return {
    ...(mr.sha && SHA.test(mr.sha) ? { headSha: mr.sha } : {}),
    ...(mr.target_branch ? { baseRef: mr.target_branch } : {}),
  };
}

/** `+` / `-` lines of a GitLab per-file patch (it carries hunks only, no `---`/`+++`). */
function countChanges(diff: string | undefined): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of (diff ?? "").split("\n")) {
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  return { additions, deletions };
}

/** The MR's changed files as `PrFileChange`s (review level + CODEOWNERS scope). Throws on any failure. */
export async function gitlabPrFiles(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<PrFileChange[]> {
  return (await readGitlabMrDiffs(client, link, iid)).flatMap((f) => {
    const filename = f.new_path ?? f.old_path;
    if (!filename) return [];
    return [
      {
        filename,
        ...(f.renamed_file && f.old_path && f.old_path !== filename
          ? { previousFilename: f.old_path }
          : {}),
        ...countChanges(f.diff),
      },
    ];
  });
}

/**
 * New-side lines a text position may point at: added lines (no old line) and context lines
 * (with their old line — GitLab wants both for an unchanged line).
 */
export function commentableLines(diff: string | undefined): Map<number, number | undefined> {
  const lines = new Map<number, number | undefined>();
  let oldLine = 0;
  let newLine = 0;
  for (const text of (diff ?? "").split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
    } else if (text.startsWith("+")) lines.set(newLine++, undefined);
    else if (text.startsWith("-")) oldLine++;
    else if (text.startsWith(" ")) lines.set(newLine++, oldLine++);
  }
  return lines;
}

/** `POST merge_requests/:iid/notes`; returns the note id. */
export async function postGitlabNote(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  body: string,
): Promise<number | undefined> {
  const note = await client.api<{ id?: number } | undefined>(
    link.host,
    `${mrPath(client, link, iid)}/notes`,
    { method: "POST", body: { body } },
  );
  return note?.id;
}

/**
 * The review verdict: `APPROVE` → approve (pinned to `sha` when given, so a moved head is
 * refused); `REQUEST_CHANGES` → unapprove when the operator had approved (404 = nothing to
 * undo); `COMMENT` → nothing.
 */
export async function applyGitlabVerdict(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  event: PrReviewEvent,
  sha?: string,
): Promise<void> {
  const base = mrPath(client, link, iid);
  if (event === "APPROVE") {
    await client.api(link.host, `${base}/approve`, {
      method: "POST",
      ...(sha ? { body: { sha } } : {}),
    });
  } else if (event === "REQUEST_CHANGES") {
    const me = (link.username ?? (await readGitlabViewer(client, link.host)) ?? "").toLowerCase();
    if (!me)
      throw new GitlabApiError(
        "cannot tell which GitLab user is the operator, so the approval was not checked",
        422,
      );
    const approvals = await readGitlabApprovals(client, link, iid).catch(
      unavailable<GitlabApprovals>({}),
    );
    if ((approvals.approved_by ?? []).some((a) => a.user?.username?.toLowerCase() === me)) {
      await client
        .api(link.host, `${base}/unapprove`, { method: "POST" })
        .catch((error: unknown) => {
          // 404 = nothing to undo; a 403 (no permission) must surface.
          if (!(error instanceof GitlabApiError && error.status === 404)) throw error;
        });
    }
  }
}

/** GitLab has no request-changes state: without a note it would only unapprove, so it is refused. */
export function refuseEmptyRequestChanges(event: PrReviewEvent, body = "", comments = 0): void {
  if (event === "REQUEST_CHANGES" && !body.trim() && !comments) {
    throw new GitlabApiError(
      "a GitLab request-changes review needs a summary or a comment; nothing was posted",
      422,
    );
  }
}

/**
 * Posts a parked review: every inline finding as its own discussion with a text `position`
 * (a finding whose line is not in the diff, or that GitLab rejects with a 400, is folded into
 * the summary), the summary as one MR note. The verdict is applied first, so a refusal leaves nothing behind. Anything else GitLab answers
 * propagates — with what was already posted in the message, as nothing here is atomic.
 */
export async function postGitlabReview(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  input: {
    event: PrReviewEvent;
    summary: string;
    comments: PrReviewInlineComment[];
    headSha?: string;
  },
): Promise<{ note?: string; inline: number }> {
  refuseEmptyRequestChanges(input.event, input.summary, input.comments.length);
  const [mr, files] = await Promise.all([
    readGitlabMr(client, link, iid),
    readGitlabMrDiffs(client, link, iid),
  ]);
  const refs = mr.diff_refs;
  const moved = input.headSha !== undefined && refs?.head_sha !== input.headSha;
  const positioned = !moved && refs?.base_sha && refs.start_sha && refs.head_sha ? refs : null;
  if (moved && input.event === "APPROVE") {
    throw new Error(
      "the MR head changed since the review started, so it cannot be approved; nothing was posted",
    );
  }
  const byPath = new Map(files.map((f) => [f.new_path ?? f.old_path ?? "", f]));
  const folded: PrReviewInlineComment[] = [];
  const posted: string[] = [];
  let rejected = 0;
  let notInDiff = 0;
  let inline = 0;
  try {
    // The verdict goes first: when GitLab refuses it nothing else has been posted yet.
    await applyGitlabVerdict(client, link, iid, input.event, input.headSha);
    if (input.event !== "COMMENT")
      posted.push(input.event === "APPROVE" ? "approval" : "unapproval");
    for (const c of input.comments) {
      const file = byPath.get(c.path);
      const lines = file ? commentableLines(file.diff) : undefined;
      if (!positioned) {
        folded.push(c);
        continue;
      }
      if (!file || !lines?.has(c.line)) {
        folded.push(c);
        notInDiff++;
        continue;
      }
      const oldLine = lines.get(c.line);
      try {
        await client.api(link.host, `${mrPath(client, link, iid)}/discussions`, {
          method: "POST",
          body: {
            body: c.body,
            position: {
              position_type: "text",
              base_sha: positioned.base_sha,
              start_sha: positioned.start_sha,
              head_sha: positioned.head_sha,
              new_path: file.new_path ?? c.path,
              old_path: file.old_path ?? file.new_path ?? c.path,
              new_line: c.line,
              ...(oldLine !== undefined ? { old_line: oldLine } : {}),
            },
          },
        });
        inline++;
        posted.push(`${c.path}:${c.line}`);
      } catch (error) {
        if (!(error instanceof GitlabApiError && error.status === 400)) throw error;
        folded.push(c);
        rejected++;
      }
    }
    const body = foldComments(input.summary, folded);
    if (body) {
      await postGitlabNote(client, link, iid, body);
      posted.push("summary note");
    }
  } catch (error) {
    const done = posted.length ? ` (already posted: ${posted.join(", ")})` : "";
    const message = error instanceof Error ? error.message : String(error);
    // Keep GitLab's status (a 403/422 must not read as a 500 upstream).
    throw error instanceof GitlabApiError
      ? new GitlabApiError(`${message}${done}`, error.status)
      : new Error(`${message}${done}`);
  }
  const reasons = [
    ...(moved ? ["the MR head moved since the review started"] : []),
    ...(!moved && !positioned ? ["the MR has no diff refs"] : []),
    ...(notInDiff ? [`${notInDiff} not on a line of the diff`] : []),
    ...(rejected ? [`${rejected} rejected by GitLab`] : []),
  ];
  return {
    inline,
    ...(folded.length
      ? {
          note: `${folded.length} inline comment(s) folded into the summary: ${reasons.join("; ")}`,
        }
      : {}),
  };
}
