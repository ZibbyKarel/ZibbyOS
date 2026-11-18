import type { CredentialsInput, Integration } from "@zibby/contracts";
import type { GitlabClient } from "../git-host/gitlab-client";
import type {
  MonitorAdapter,
  MonitorAlert,
  MonitorPollResult,
  MonitorStatusSnapshot,
} from "./monitor-adapter";

interface GitlabPipeline {
  id?: number;
  sha?: string;
  ref?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  web_url?: string;
}

interface GitlabMr {
  iid?: number;
  source_branch?: string;
}

/**
 * GitLab CI (via the `glab` CLI, no stored credential): the twin of {@link GithubCiMonitor}.
 * One poll reads the project's default branch, the operator's open MRs and the newest
 * pipelines (by `updated_at`, so a pipeline that FINISHES red after an earlier poll still
 * surfaces). An alert is a `failed` pipeline on the default branch or on one of those MRs
 * (merge-request pipeline `refs/merge-requests/<iid>/head`, a merged-results pipeline
 * `refs/merge-requests/<iid>/merge`, or a branch pipeline of an MR source branch) — id
 * `ci-<repo>-<pipelineId>-<updated_at digits>`: a re-poll is a pure dedup hit, while a retried
 * pipeline that fails again (same id, newer `updated_at`) alerts again, like GitHub's
 * `run_attempt`.
 * The operator's login is the MR author for ZIBBY's MRs too (it pushes with that login).
 */
export class GitlabCiMonitor implements MonitorAdapter {
  readonly kind = "gitlab-ci" as const;

  constructor(private readonly client: GitlabClient) {}

  wants(integration: Integration): boolean {
    return integration.config.kind === "gitlab" && integration.config.streams.includes("ci");
  }

  async poll(
    integration: Integration,
    _creds: CredentialsInput,
    cursor: string | undefined,
  ): Promise<MonitorPollResult> {
    if (integration.config.kind !== "gitlab") throw new Error("not a gitlab integration");
    // A company-owned integration has no repo of its own; the watcher polls it per
    // inheriting project repo with `config.repo` filled in.
    const { host, repo, username } = integration.config;
    if (!repo) throw new Error("gitlab integration has no repo");
    const project = this.client.projectPath(repo);

    const [{ default_branch: defaultBranch }, mrs, pipelines] = await Promise.all([
      this.client.api<{ default_branch?: string }>(host, project),
      this.client.api<GitlabMr[]>(
        host,
        `${project}/merge_requests?state=opened&author_username=${encodeURIComponent(username)}&per_page=50`,
      ),
      this.client.api<GitlabPipeline[] | undefined>(
        host,
        `${project}/pipelines?order_by=updated_at&sort=desc&per_page=50`,
      ),
    ]);
    const mine = new Set<string>();
    for (const mr of mrs ?? []) {
      if (mr.iid !== undefined) {
        mine.add(`refs/merge-requests/${mr.iid}/head`);
        mine.add(`refs/merge-requests/${mr.iid}/merge`);
      }
      if (mr.source_branch) mine.add(mr.source_branch);
    }
    const list = Array.isArray(pipelines) ? pipelines : [];

    const events: MonitorAlert[] = [];
    let newest = cursor;
    for (const p of list) {
      const updated = p.updated_at ?? p.created_at ?? new Date(0).toISOString();
      if (newest === undefined || updated > newest) newest = updated;
      if (cursor !== undefined && updated <= cursor) continue;
      if (p.id === undefined || p.status !== "failed") continue;
      if (p.ref !== defaultBranch && !(p.ref && mine.has(p.ref))) continue;
      events.push({
        id: `ci-${repo.replace(/\//g, "-")}-${p.id}-${updated.replace(/\D/g, "")}`,
        kind: "ci-run-failed",
        title: `CI red: pipeline ${p.id} failed on ${p.ref ?? "?"}`,
        detail: [
          `Repository: ${repo} (${host})`,
          `Pipeline: ${p.id}`,
          `Ref: ${p.ref ?? "?"} @ ${p.sha ?? "?"}`,
          "Status: failed",
        ].join("\n"),
        ...(p.web_url ? { url: p.web_url } : {}),
        occurredAt: new Date(updated).toISOString(),
      });
    }
    const status = computeStatus(list.filter((p) => p.ref === defaultBranch));
    return { events, cursor: newest, ...(status ? { status } : {}) };
  }
}

/** Current default-branch health, same rules as the GitHub monitor: only failed/success decide. */
function computeStatus(pipelines: GitlabPipeline[]): MonitorStatusSnapshot | undefined {
  const stateOf = (p: GitlabPipeline): "red" | "green" | null =>
    p.status === "failed" ? "red" : p.status === "success" ? "green" : null;
  const decisive = pipelines
    .map((pipeline) => ({ pipeline, state: stateOf(pipeline) }))
    .filter((d): d is { pipeline: GitlabPipeline; state: "red" | "green" } => d.state !== null);
  const newest = decisive[0];
  if (!newest) return undefined;
  let oldestInStreak = newest.pipeline;
  for (const d of decisive) {
    if (d.state !== newest.state) break;
    oldestInStreak = d.pipeline;
  }
  const at = (p: GitlabPipeline): string =>
    new Date(p.updated_at ?? p.created_at ?? 0).toISOString();
  return {
    state: newest.state,
    sinceAt: at(oldestInStreak),
    checkedAt: new Date().toISOString(),
    summary: `pipeline ${newest.state === "red" ? "failed" : "passing"} on ${newest.pipeline.ref ?? "?"}`,
    ...(newest.pipeline.web_url ? { url: newest.pipeline.web_url } : {}),
  };
}
