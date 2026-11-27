import type {
  InboxPrReviewer,
  InboxPrReviewers,
  InboxPrThread,
  SubmitInboxPrReviewInput,
  SubmitInboxPrReviewResult,
} from "@zibby/contracts";
import { prWebUrl } from "../git-host/git-host-url";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import {
  gitlabCodeOwnersOf,
  isGroupOwner,
  readGitlabCodeowners,
  readGitlabGroupMembers,
} from "./code-owners.gitlab";
import { readGitlabMrDiffs } from "./inbox-pr-diff.gitlab";
import {
  applyGitlabVerdict,
  postGitlabNote,
  refuseEmptyRequestChanges,
} from "./inbox-review.gitlab";
import {
  type GitlabApprovals,
  type GitlabLink,
  type GitlabMr,
  readGitlabApprovals,
  readGitlabDiscussions,
  readGitlabMr,
  readGitlabReviewers,
  readGitlabViewer,
  unavailable,
} from "./inbox.gitlab";

/** Resolvable discussions of the MR as review threads (plain comments and system notes are not threads). */
export async function gitlabThreads(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<InboxPrThread[]> {
  const threads: InboxPrThread[] = [];
  const viewer = (await readGitlabViewer(client, link.host).catch(() => undefined))?.toLowerCase();
  for (const d of await readGitlabDiscussions(client, link, iid)) {
    const notes = (d.notes ?? []).filter((n) => !n.system && n.id !== undefined);
    const first = notes[0];
    if (!d.id || !first?.resolvable) continue;
    const pos = first.position;
    const line = pos?.new_line ?? pos?.old_line ?? null;
    const start = pos?.line_range?.start;
    const startLine = start?.new_line ?? start?.old_line ?? null;
    threads.push({
      id: d.id,
      isResolved: notes.filter((n) => n.resolvable).every((n) => n.resolved),
      // ponytail: GitLab has no "outdated" flag on a discussion; a moved diff line is not detected.
      isOutdated: false,
      path: pos?.new_path ?? pos?.old_path ?? "",
      line,
      startLine: startLine !== null && startLine !== line ? startLine : null,
      // ponytail: discussions carry no diff hunk; the UI shows the thread without code context.
      diffHunk: "",
      ...(first.id
        ? { url: `${prWebUrl({ kind: "gitlab", ...link }, iid)}#note_${first.id}` }
        : {}),
      ...(viewer && first.author?.username?.toLowerCase() === viewer ? { mine: true } : {}),
      comments: notes.map((n) => ({
        id: String(n.id),
        author: n.author?.username
          ? { login: n.author.username, avatarUrl: n.author.avatar_url ?? "" }
          : null,
        createdAt: n.created_at ?? "",
        body: n.body ?? "",
      })),
    });
  }
  return threads;
}

/**
 * GitLab user id of `username` (`users?username=`, exact match). Needed wherever a reviewer is
 * set (`reviewer_ids` takes ids); an unknown name is a 422, not a silent skip.
 */
export async function resolveGitlabUserId(
  client: GitlabClient,
  host: string,
  username: string,
): Promise<number> {
  const users =
    (await client.api<{ id?: number; username?: string }[] | undefined>(
      host,
      `users?username=${encodeURIComponent(username)}`,
    )) ?? [];
  const id = users.find((u) => u.username?.toLowerCase() === username.toLowerCase())?.id;
  if (id === undefined) throw new GitlabApiError(`GitLab user "${username}" not found`, 422);
  return id;
}

/** Changed paths of the MR and the CODEOWNERS owners of each (GitLab sections, last match per section). */
async function ownershipOf(
  client: GitlabClient,
  link: GitlabLink,
  mr: Pick<GitlabMr, "target_branch">,
  iid: number,
): Promise<{ owners: Set<string> }> {
  const [codeowners, diffs] = await Promise.all([
    readGitlabCodeowners(client, link, mr.target_branch),
    readGitlabMrDiffs(client, link, iid),
  ]);
  const owners = new Set<string>();
  if (codeowners)
    for (const f of diffs)
      for (const path of new Set([f.new_path, f.old_path]))
        if (path) for (const o of gitlabCodeOwnersOf(codeowners.text, path)) owners.add(o);
  return { owners };
}

const lower = (s: string | undefined) => (s ?? "").toLowerCase();

/**
 * The MR's reviewers tree: requested reviewers (verdict from their reviewer state, plus anyone
 * who approved), nested under the CODEOWNERS groups of the changed files they belong to.
 */
export async function gitlabReviewers(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<InboxPrReviewers> {
  const mr = await readGitlabMr(client, link, iid);
  const [reviewers, approvals, discussions, { owners }] = await Promise.all([
    readGitlabReviewers(client, link, iid),
    readGitlabApprovals(client, link, iid).catch(unavailable<GitlabApprovals>({})),
    readGitlabDiscussions(client, link, iid),
    ownershipOf(client, link, mr, iid),
  ]);
  const author = lower(mr.author?.username);
  const approvedBy = new Set(
    (approvals.approved_by ?? []).map((a) => lower(a.user?.username)).filter(Boolean),
  );
  const commenters = new Set(
    discussions.flatMap((d) =>
      (d.notes ?? []).filter((n) => !n.system).map((n) => lower(n.author?.username)),
    ),
  );
  const people = new Map<string, InboxPrReviewer>();
  const add = (login: string, state: InboxPrReviewer["state"]) => {
    const key = lower(login);
    if (!key || key === author || people.has(key)) return;
    people.set(key, { login, state, commented: commenters.has(key) });
  };
  for (const r of reviewers) {
    const login = r.user?.username ?? "";
    add(
      login,
      approvedBy.has(lower(login)) || r.state === "approved"
        ? "approved"
        : r.state === "requested_changes"
          ? "changesRequested"
          : r.state === "reviewed"
            ? "commented"
            : "pending",
    );
  }
  for (const a of approvals.approved_by ?? []) add(a.user?.username ?? "", "approved");

  const placed = new Set<string>();
  const teams = await Promise.all(
    [...owners].filter(isGroupOwner).map(async (owner) => {
      const group = owner.slice(1);
      const memberNames = new Set(
        (await readGitlabGroupMembers(client, link.host, group)).map((m) => lower(m.username)),
      );
      const members = [...people].filter(([key]) => memberNames.has(key)).map(([, p]) => p);
      for (const m of members) placed.add(lower(m.login));
      return { slug: group, name: group, codeOwner: true, requested: false, members };
    }),
  );
  return { teams, users: [...people.values()].filter((p) => !placed.has(lower(p.login))) };
}

/**
 * Adds `username` to the MR's reviewers. `reviewer_ids` replaces the whole list, so the current
 * reviewers' ids are sent along; one without an id aborts rather than being dropped. Returns
 * false (no PUT) when the user already is a reviewer: GitLab's REST API cannot re-request them.
 */
export async function requestGitlabReview(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  username: string,
): Promise<boolean> {
  const [id, current] = await Promise.all([
    resolveGitlabUserId(client, link.host, username),
    readGitlabReviewers(client, link, iid),
  ]);
  const ids = current.map((r) => {
    if (r.user?.id === undefined)
      throw new GitlabApiError(`reviewer ${r.user?.username ?? "?"} has no id`, 422);
    return r.user.id;
  });
  if (ids.includes(id)) return false;
  await client.api(link.host, `${client.projectPath(link.repo)}/merge_requests/${iid}`, {
    method: "PUT",
    body: { reviewer_ids: [...ids, id] },
  });
  return true;
}

const discussionPath = (client: GitlabClient, link: GitlabLink, iid: number, id: string) =>
  `${client.projectPath(link.repo)}/merge_requests/${iid}/discussions/${encodeURIComponent(id)}`;

/** `PUT discussions/:id?resolved=true` (idempotent). */
export async function resolveGitlabDiscussion(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  id: string,
): Promise<void> {
  await client.api(link.host, `${discussionPath(client, link, iid, id)}?resolved=true`, {
    method: "PUT",
  });
}

/** `POST discussions/:id/notes`. */
export async function replyGitlabDiscussion(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  id: string,
  body: string,
): Promise<void> {
  await client.api(link.host, `${discussionPath(client, link, iid, id)}/notes`, {
    method: "POST",
    body: { body },
  });
}

/**
 * The operator's own review: the body (when given) as one MR note, then the verdict. The
 * contract's `id` is GitHub's review id; here it is the note id, or the MR number for a bare approve.
 */
export async function submitGitlabReview(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  input: SubmitInboxPrReviewInput,
): Promise<SubmitInboxPrReviewResult> {
  refuseEmptyRequestChanges(input.event, input.body);
  // Verdict first: a refusal then leaves no note behind for a retry to duplicate.
  await applyGitlabVerdict(client, link, iid, input.event);
  const noteId = input.body ? await postGitlabNote(client, link, iid, input.body) : undefined;
  return { id: noteId ?? iid };
}
