import type { InboxPr, InboxPrCi, InboxPrReview, Project } from "@zibby/contracts";
import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import { blockerOf, capDescription, ciDetails, ciState, sectionOf } from "./inbox.service";

/** The GitLab project a link points at (host + full path). */
export interface GitlabLink {
  host: string;
  repo: string;
  username?: string;
}

export interface GitlabMr {
  iid?: number;
  title?: string;
  description?: string | null;
  web_url?: string;
  draft?: boolean;
  state?: string;
  created_at?: string;
  updated_at?: string;
  author?: { username?: string; name?: string; avatar_url?: string | null } | null;
  source_branch?: string;
  target_branch?: string;
  source_project_id?: number;
  target_project_id?: number;
  sha?: string;
  detailed_merge_status?: string;
  has_conflicts?: boolean;
  diverged_commits_count?: number | null;
  head_pipeline?: { id?: number; status?: string } | null;
  diff_refs?: { base_sha?: string; start_sha?: string; head_sha?: string } | null;
}

export interface GitlabJob {
  name?: string;
  status?: string;
  allow_failure?: boolean;
  finished_at?: string | null;
}

export interface GitlabApprovals {
  approved?: boolean;
  approved_by?: { user?: { username?: string } }[];
}

export interface GitlabReviewer {
  user?: { id?: number; username?: string };
  state?: string; // unreviewed | review_started | approved | requested_changes
}

export interface GitlabNote {
  id?: number;
  system?: boolean;
  body?: string;
  created_at?: string;
  author?: { username?: string; avatar_url?: string | null; bot?: boolean } | null;
  resolvable?: boolean;
  resolved?: boolean;
  /** Present on diff notes (inline code comments). */
  position?: {
    new_path?: string | null;
    old_path?: string | null;
    new_line?: number | null;
    old_line?: number | null;
    line_range?: {
      start?: { new_line?: number | null; old_line?: number | null };
    } | null;
  } | null;
}

export interface GitlabDiscussion {
  id?: string;
  notes?: GitlabNote[];
}

export interface GitlabIssue {
  iid?: number;
  title?: string;
  description?: string | null;
  web_url?: string;
  updated_at?: string;
}

const projectOf = (client: GitlabClient, link: GitlabLink) => client.projectPath(link.repo);

/** One MR with `diverged_commits_count` (behind-ness) and its `head_pipeline`. */
export function readGitlabMr(client: GitlabClient, link: GitlabLink, iid: number) {
  return client.api<GitlabMr>(
    link.host,
    `${projectOf(client, link)}/merge_requests/${iid}?include_diverged_commits_count=true`,
  );
}

/** Jobs of one pipeline (retried jobs excluded by GitLab's default). */
export async function readGitlabPipelineJobs(
  client: GitlabClient,
  link: GitlabLink,
  pipelineId: number,
): Promise<GitlabJob[]> {
  return (
    (await client.api<GitlabJob[] | undefined>(
      link.host,
      `${projectOf(client, link)}/pipelines/${pipelineId}/jobs?per_page=100`,
    )) ?? []
  );
}

/** Jobs of the MR's head pipeline; none when it has no pipeline. */
export async function readGitlabMrJobs(
  client: GitlabClient,
  link: GitlabLink,
  mr: Pick<GitlabMr, "head_pipeline">,
): Promise<GitlabJob[]> {
  const id = mr.head_pipeline?.id;
  return id === undefined ? [] : readGitlabPipelineJobs(client, link, id);
}

export function readGitlabApprovals(client: GitlabClient, link: GitlabLink, iid: number) {
  return client.api<GitlabApprovals>(
    link.host,
    `${projectOf(client, link)}/merge_requests/${iid}/approvals`,
  );
}

export async function readGitlabReviewers(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<GitlabReviewer[]> {
  return (
    (await client.api<GitlabReviewer[] | undefined>(
      link.host,
      `${projectOf(client, link)}/merge_requests/${iid}/reviewers`,
    )) ?? []
  );
}

export async function readGitlabDiscussions(
  client: GitlabClient,
  link: GitlabLink,
  iid: number,
): Promise<GitlabDiscussion[]> {
  return (
    (await client.api<GitlabDiscussion[] | undefined>(
      link.host,
      `${projectOf(client, link)}/merge_requests/${iid}/discussions?per_page=100`,
      { paginate: true },
    )) ?? []
  );
}

/** Username of the logged-in `glab` user on a host. */
export async function readGitlabViewer(
  client: GitlabClient,
  host: string,
): Promise<string | undefined> {
  const user = await client.api<{ username?: string } | undefined>(host, "user");
  return user?.username;
}

/** Resolvable discussions with at least one unresolved resolvable note. */
export function countUnresolvedDiscussions(discussions: readonly GitlabDiscussion[]): number {
  return discussions.filter((d) => (d.notes ?? []).some((n) => n.resolvable && !n.resolved)).length;
}

/** A GitLab job as the check-run shape `ciState`/`ciDetails` read (a failed `allow_failure` job is neutral). */
export function jobAsCheckRun(job: GitlabJob): {
  name?: string;
  status: string;
  conclusion: string | null;
  completed_at?: string | null;
} {
  const base = { ...(job.name ? { name: job.name } : {}), completed_at: job.finished_at ?? null };
  switch (job.status) {
    case "success":
      return { ...base, status: "completed", conclusion: "success" };
    case "failed":
      return {
        ...base,
        status: "completed",
        conclusion: job.allow_failure ? "neutral" : "failure",
      };
    case "canceled":
    case "canceling":
      return { ...base, status: "completed", conclusion: "cancelled" };
    case "skipped":
    case "manual": // a manual job gates nothing until someone plays it
      return { ...base, status: "completed", conclusion: "skipped" };
    default: // created, pending, running, preparing, scheduled, waiting_for_resource
      return { ...base, status: "in_progress", conclusion: null };
  }
}

/** CI fields of an MR from its head pipeline's jobs; ignored job names are left out like ignored checks. */
export function gitlabCiFields(
  jobs: readonly GitlabJob[],
  ignored?: readonly string[],
): { ci: InboxPrCi } & ReturnType<typeof ciDetails> {
  const runs = jobs.map(jobAsCheckRun);
  return { ci: ciState(runs, ignored), ...ciDetails(runs, ignored) };
}

/** `mergeable` from `detailed_merge_status` (`has_conflicts` also reads as a conflict). */
export function gitlabMergeable(mr: Pick<GitlabMr, "detailed_merge_status" | "has_conflicts">) {
  const status = mr.detailed_merge_status;
  if (status === "conflict" || status === "need_rebase" || mr.has_conflicts) return false;
  return status === "mergeable" ? true : null;
}

/** Aggregate review state: any reviewer's `requested_changes` wins, then GitLab's own `approved`. */
export function gitlabReviewState(
  approvals: GitlabApprovals | null,
  reviewers: readonly GitlabReviewer[],
  author: string,
): InboxPrReview {
  if (reviewers.some((r) => r.state === "requested_changes" && r.user?.username !== author)) {
    return "changes-requested";
  }
  return approvals?.approved === true ? "approved" : "none";
}

/** The operator's own verdict on an MR, from the reviewer state or the approvals list. */
export function gitlabMyVerdict(
  approvals: GitlabApprovals | null,
  reviewers: readonly GitlabReviewer[],
  me: string | undefined,
): "approved" | "changes-requested" | undefined {
  if (!me) return undefined;
  const mine = reviewers.find((r) => r.user?.username === me)?.state;
  if (mine === "requested_changes") return "changes-requested";
  if (mine === "approved" || approvals?.approved_by?.some((a) => a.user?.username === me)) {
    return "approved";
  }
  return undefined;
}

type Bucket = Pick<InboxPr, "bucket" | "reviewReason">;

/** At most this many MRs load at once (each costs 4-5 `glab` calls). */
const LOAD_CONCURRENCY = 4;

/** `Promise.allSettled` over `items` with a bounded number in flight. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) {
      const item = items[i] as T;
      out[i] = await fn(item).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Only an endpoint that legitimately may not exist (403/404, e.g. approvals on a tier without them) degrades; anything else rejects the MR load. */
export const unavailable =
  <T>(fallback: T) =>
  (error: unknown): T => {
    if (error instanceof GitlabApiError && (error.status === 403 || error.status === 404)) {
      return fallback;
    }
    throw error;
  };

const OPENED = "state=opened&per_page=100";

async function listIids(client: GitlabClient, link: GitlabLink, query: string): Promise<number[]> {
  const mrs =
    (await client.api<GitlabMr[] | undefined>(
      link.host,
      `${projectOf(client, link)}/merge_requests?${OPENED}&${query}`,
    )) ?? [];
  return mrs.flatMap((m) => (m.iid === undefined ? [] : [m.iid]));
}

/**
 * The operator's open MRs of one GitLab project as `InboxPr`s: authored (`mine`), assigned to the
 * operator (`mine`), review requested (`to-review`, or `reviewed` once the operator's reviewer
 * state is approved / requested_changes). One MR that fails to load is skipped only when the failure
 * is a 403/404 on an optional endpoint (see `unavailable`); any other failure, and a failed list,
 * surfaces as an `InboxSourceError`.
 */
export async function listGitlabInboxPrs(
  client: GitlabClient,
  link: GitlabLink,
  project: Project,
  viewer?: string,
  notes: string[] = [],
): Promise<InboxPr[]> {
  const me = link.username ?? viewer ?? (await readGitlabViewer(client, link.host));
  const [authored, assigned, requested] = await Promise.all([
    listIids(client, link, "scope=created_by_me"),
    listIids(client, link, "scope=assigned_to_me"),
    me ? listIids(client, link, `reviewer_username=${encodeURIComponent(me)}`) : [],
  ]);
  const buckets = new Map<number, Bucket>();
  for (const n of requested) buckets.set(n, { bucket: "to-review", reviewReason: "direct" });
  for (const n of assigned) buckets.set(n, { bucket: "mine" });
  for (const n of authored) buckets.set(n, { bucket: "mine" });

  const load = async (iid: number, bucket: Bucket): Promise<InboxPr> => {
    const mr = await readGitlabMr(client, link, iid);
    const [approvals, reviewers, jobs, discussions] = await Promise.all([
      readGitlabApprovals(client, link, iid).catch(unavailable(null)),
      readGitlabReviewers(client, link, iid).catch(unavailable([])),
      readGitlabMrJobs(client, link, mr).catch(unavailable(null)),
      bucket.bucket === "mine"
        ? readGitlabDiscussions(client, link, iid).catch(() => null)
        : Promise.resolve(null),
    ]);
    const author = mr.author?.username ?? "";
    const verdict =
      bucket.bucket === "mine" ? undefined : gitlabMyVerdict(approvals, reviewers, me);
    // GitLab keeps the reviewer on the MR after they reviewed; a verdict moves it to "reviewed".
    const placed: Bucket =
      bucket.bucket === "to-review" && verdict ? { bucket: "reviewed" } : bucket;
    const ci = jobs ? gitlabCiFields(jobs, project.ciIgnoredChecks) : { ci: "unknown" as const };
    const review = gitlabReviewState(approvals, reviewers, author);
    const mergeable = gitlabMergeable(mr);
    const draft = mr.draft === true;
    const description = mr.description?.trim() ? capDescription(mr.description) : {};
    return {
      source: "gitlab",
      number: iid,
      title: mr.title ?? "",
      ...description,
      url: mr.web_url ?? `https://${link.host}/${link.repo}/-/merge_requests/${iid}`,
      repo: link.repo,
      author,
      ...(mr.author?.name ? { authorName: mr.author.name } : {}),
      ...(mr.author?.avatar_url?.startsWith("https://")
        ? { authorAvatarUrl: mr.author.avatar_url }
        : {}),
      createdAt: new Date(mr.created_at ?? Date.now()).toISOString(),
      ...(mr.updated_at ? { updatedAt: new Date(mr.updated_at).toISOString() } : {}),
      draft,
      ...ci,
      review,
      mergeable,
      ...((mr.diverged_commits_count ?? 0) > 0 ? { behind: true } : {}),
      ...(mr.source_branch && mr.source_project_id === mr.target_project_id
        ? { headRef: mr.source_branch }
        : {}),
      ...(mr.target_branch ? { baseRef: mr.target_branch } : {}),
      ...(mr.sha && /^[0-9a-f]{40}$/.test(mr.sha) ? { headSha: mr.sha } : {}),
      ...(discussions ? { unresolvedThreads: countUnresolvedDiscussions(discussions) } : {}),
      ...placed,
      ...(verdict
        ? { myReview: verdict }
        : placed.bucket === "reviewed"
          ? { myReview: "commented" as const }
          : {}),
      blocker: blockerOf({ ci: ci.ci, review, mergeable }),
      section: sectionOf({ ...placed, ci: ci.ci, review, mergeable, draft }),
      projectId: project.id,
      ...(project.companyId ? { companyId: project.companyId } : {}),
      ...(project.teamId ? { teamId: project.teamId } : {}),
    };
  };

  const results = await mapLimit([...buckets], LOAD_CONCURRENCY, ([iid, bucket]) =>
    load(iid, bucket),
  );
  const prs: InboxPr[] = [];
  const failures: unknown[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") prs.push(r.value);
    else failures.push(r.reason);
  }
  // Every MR failing is a broken project (auth, network): throw so the caller records a source error.
  if (failures.length > 0 && prs.length === 0) throw failures[0];
  // Partial failure keeps the MRs that loaded and reports the rest (like GitHub's `notes`).
  if (failures.length > 0) {
    const reason = (failures[0] as Error).message || "unknown error";
    notes.push(`${link.repo}: ${failures.length} merge request(s) failed to load (${reason})`);
  }
  return prs;
}

/** Open issues assigned to the operator in one GitLab project (first 100). */
export async function listGitlabAssignedIssues(
  client: GitlabClient,
  link: GitlabLink,
): Promise<GitlabIssue[]> {
  return (
    (await client.api<GitlabIssue[] | undefined>(
      link.host,
      `${projectOf(client, link)}/issues?${OPENED}&scope=assigned_to_me`,
    )) ?? []
  );
}
