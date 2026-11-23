import type { CredentialsInput, Integration } from "@zibby/contracts";
import {
  GithubRunsHttpError,
  GithubRunsReader,
  type GithubWorkflowRun,
} from "../git-host/github-runs.reader";
import type {
  MonitorAdapter,
  MonitorAlert,
  MonitorPollResult,
  MonitorStatusSnapshot,
} from "./monitor-adapter";

/** Workflow-run conclusions that read as "the build is red". */
const RED_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure"]);

/** PAT from the closed credentials union (null if absent). */
function tokenOf(creds: CredentialsInput): string | null {
  return "token" in creds ? creds.token : null;
}

/**
 * The first monitor (N3): GitHub Actions. Reads `/repos/{repo}/actions/runs`
 * (newest-first, through the shared {@link GithubRunsReader}) for an integration whose `streams` opted into `"ci"`, keeps a
 * `created_at` cursor, and yields one alert per COMPLETED run with a red
 * conclusion — id `ci-<repo>-<runId>-<attempt>`, so a retried workflow is a new
 * occurrence and a re-poll a pure dedup hit. Green/in-progress runs are a no-op.
 * Rate limits throw (the watcher's retry/backoff owns the failure boundary).
 */
export class GithubCiMonitor implements MonitorAdapter {
  readonly kind = "github-ci" as const;

  constructor(
    fetchImpl: typeof fetch = fetch,
    private readonly reader = new GithubRunsReader(fetchImpl),
  ) {}

  wants(integration: Integration): boolean {
    return integration.config.kind === "github" && integration.config.streams.includes("ci");
  }

  async poll(
    integration: Integration,
    creds: CredentialsInput,
    cursor: string | undefined,
  ): Promise<MonitorPollResult> {
    if (integration.config.kind !== "github") throw new Error("not a github integration");
    const token = tokenOf(creds);
    if (!token) throw new Error("no github token configured");
    // A company-owned integration has no repo of its own; the watcher polls it per
    // inheriting project's repo (phase 129) with `config.repo` filled in.
    const { repo } = integration.config;
    if (!repo) throw new Error("github integration has no repo");

    const runs = await this.reader.runs(repo, token).catch((err: unknown) => {
      if (err instanceof GithubRunsHttpError && (err.status === 429 || err.status === 403))
        throw new Error(`github rate limited (HTTP ${err.status})`);
      throw err;
    });

    const events: MonitorAlert[] = [];
    let newest = cursor;
    for (const run of runs) {
      const created = run.created_at ?? new Date(0).toISOString();
      if (newest === undefined || created > newest) newest = created;
      // Only runs newer than the cursor are considered; the deterministic id keeps
      // the boundary replay-safe either way.
      if (cursor !== undefined && created <= cursor) continue;
      if (run.id === undefined || run.status !== "completed") continue;
      if (!RED_CONCLUSIONS.has(run.conclusion ?? "")) continue;
      const attempt = run.run_attempt ?? 1;
      events.push({
        id: `ci-${repo.replace("/", "-")}-${run.id}-${attempt}`,
        kind: "ci-run-failed",
        title: `CI red: ${run.name ?? "workflow"} failed on ${run.head_branch ?? "?"}`,
        detail: [
          `Repository: ${repo}`,
          `Workflow: ${run.name ?? "?"} (run ${run.id}, attempt ${attempt})`,
          `Branch: ${run.head_branch ?? "?"} @ ${run.head_sha ?? "?"}`,
          `Conclusion: ${run.conclusion}`,
        ].join("\n"),
        ...(run.html_url ? { url: run.html_url } : {}),
        occurredAt: new Date(run.updated_at ?? created).toISOString(),
      });
    }
    const status = computeStatus(runs);
    return { events, cursor: newest, ...(status ? { status } : {}) };
  }
}

/**
 * Current health from the WHOLE fetched page (N4b) — state, not an event, so it
 * ignores the cursor. Only decisive conclusions count: red (`RED_CONCLUSIONS`)
 * or green (`success`); cancelled/skipped/in-progress runs decide nothing. The
 * newest decisive run sets the state; `sinceAt` walks the consecutive same-state
 * streak (newest-first input) to its oldest run — "red since HH:MM".
 */
function computeStatus(runs: GithubWorkflowRun[]): MonitorStatusSnapshot | undefined {
  const stateOf = (run: GithubWorkflowRun): "red" | "green" | null => {
    if (run.status !== "completed") return null;
    if (RED_CONCLUSIONS.has(run.conclusion ?? "")) return "red";
    return run.conclusion === "success" ? "green" : null;
  };
  const decisive = runs
    .map((run) => ({ run, state: stateOf(run) }))
    .filter((d): d is { run: GithubWorkflowRun; state: "red" | "green" } => d.state !== null);
  const newest = decisive[0];
  if (!newest) return undefined;
  let oldestInStreak = newest.run;
  for (const d of decisive) {
    if (d.state !== newest.state) break;
    oldestInStreak = d.run;
  }
  const at = (run: GithubWorkflowRun): string =>
    new Date(run.updated_at ?? run.created_at ?? 0).toISOString();
  return {
    state: newest.state,
    sinceAt: at(oldestInStreak),
    checkedAt: new Date().toISOString(),
    summary: `${newest.run.name ?? "workflow"} ${
      newest.state === "red" ? "failed" : "passing"
    } on ${newest.run.head_branch ?? "?"}`,
    ...(newest.run.html_url ? { url: newest.run.html_url } : {}),
  };
}
