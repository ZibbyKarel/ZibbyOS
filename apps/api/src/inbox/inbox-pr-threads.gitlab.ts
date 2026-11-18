import type { InboxPrReviewer, InboxPrReviewers, InboxPrThread } from "@zibby/contracts";
import { prWebUrl } from "../git-host/git-host-url";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import {
  canReview,
  gitlabCodeOwnersOf,
  isGroupOwner,
  readGitlabCodeowners,
  readGitlabGroupMembers,
  readGitlabProjectMembers,
} from "./code-owners.gitlab";
import { readGitlabMrDiffs } from "./inbox-pr-diff.gitlab";
import {
  type GitlabApprovals,
  type GitlabLink,
  type GitlabMr,
  readGitlabApprovals,
  readGitlabDiscussions,
  readGitlabMr,
  readGitlabReviewers,
  unavailable,
} from "./inbox.gitlab";

/** Resolvable discussions of the MR as review threads (plain comments and system notes are not threads). */
export async function gitlabThreads(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<InboxPrThread[]> {
  const threads: InboxPrThread[] = [];
  for (const d of await readGitlabDiscussions(client, link, iid)) {
    const notes = (d.notes ?? []).filter((n) => !n.system);
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
      comments: notes.map((n) => ({
        id: String(n.id ?? ""),
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

export interface GitlabReviewerCandidate {
  username: string;
  /** CODEOWNERS names them (or a group they belong to) for a changed file. */
  codeOwner: boolean;
}

/**
 * Who can be asked to review: project members with Developer access or more (active accounts),
 * minus the author, CODEOWNERS of the changed files first.
 */
export async function gitlabReviewerCandidates(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<GitlabReviewerCandidate[]> {
  const mr = await readGitlabMr(client, link, iid);
  const [members, { owners }] = await Promise.all([
    readGitlabProjectMembers(client, link),
    ownershipOf(client, link, mr, iid),
  ]);
  const ownerNames = new Set(
    [...owners].filter((o) => !isGroupOwner(o)).map((o) => lower(o.slice(1))),
  );
  for (const owner of [...owners].filter(isGroupOwner))
    for (const m of await readGitlabGroupMembers(client, link.host, owner.slice(1)))
      ownerNames.add(lower(m.username));
  const author = lower(mr.author?.username);
  const out = new Map<string, GitlabReviewerCandidate>();
  for (const m of members) {
    const key = lower(m.username);
    if (!m.username || key === author || !canReview(m) || out.has(key)) continue;
    out.set(key, { username: m.username, codeOwner: ownerNames.has(key) });
  }
  return [...out.values()].sort((a, b) => Number(b.codeOwner) - Number(a.codeOwner));
}

/**
 * Adds `username` to the MR's reviewers. `reviewer_ids` replaces the whole list, so the current
 * reviewers' ids are sent along; one without an id aborts rather than being dropped.
 */
export async function requestGitlabReview(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
  username: string,
): Promise<void> {
  const [id, current] = await Promise.all([
    resolveGitlabUserId(client, link.host, username),
    readGitlabReviewers(client, link, iid),
  ]);
  const ids = current.map((r) => {
    if (r.user?.id === undefined) throw new Error(`reviewer ${r.user?.username ?? "?"} has no id`);
    return r.user.id;
  });
  await client.api(link.host, `${client.projectPath(link.repo)}/merge_requests/${iid}`, {
    method: "PUT",
    body: { reviewer_ids: [...new Set([...ids, id])] },
  });
}
