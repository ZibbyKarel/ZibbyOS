import { Injectable, Optional } from "@nestjs/common";

const GITHUB_API = "https://api.github.com";
/** One `actions/runs` read per repo per window, shared by the CI monitor and the project CI widget. */
export const GITHUB_RUNS_TTL_MS = 5 * 60_000;

/** The fields of a GitHub Actions workflow run its readers use. */
export interface GithubWorkflowRun {
  id?: number;
  run_attempt?: number;
  workflow_id?: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  head_branch?: string;
  head_sha?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
}

/** A non-2xx `actions/runs` answer; `rateLimited` = a 429 or a 403 with no requests left. */
export class GithubRunsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly rateLimited: boolean,
  ) {
    super(`github workflow runs: HTTP ${status}`);
    this.name = "GithubRunsHttpError";
  }
}

/**
 * The newest 50 workflow runs of a repo (all branches, newest first), cached per repo for
 * {@link GITHUB_RUNS_TTL_MS}. The one GitHub Actions reader: the CI monitor's alerts and the
 * Bridge's base-branch CI both come from the same read. A failed read is not cached.
 */
// ponytail: in-memory per repo, keyed without the token; fine while one operator owns every repo.
@Injectable()
export class GithubRunsReader {
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, { at: number; runs: Promise<GithubWorkflowRun[]> }>();

  constructor(@Optional() fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  /** `fresh` skips the cache (and refills it) — for a read that acts on the real state. */
  runs(repo: string, token: string, fresh = false): Promise<GithubWorkflowRun[]> {
    const key = repo.toLowerCase();
    const hit = this.cache.get(key);
    const now = Date.now();
    if (!fresh && hit && now - hit.at < GITHUB_RUNS_TTL_MS) return hit.runs;
    const entry = { at: now, runs: this.read(repo, token) };
    this.cache.set(key, entry);
    entry.runs.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
    });
    return entry.runs;
  }

  private async read(repo: string, token: string): Promise<GithubWorkflowRun[]> {
    const res = await this.fetchImpl(`${GITHUB_API}/repos/${repo}/actions/runs?per_page=50`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      const left = res.headers?.get("x-ratelimit-remaining");
      throw new GithubRunsHttpError(
        res.status,
        res.status === 429 || (res.status === 403 && left === "0"),
      );
    }
    const body = (await res.json()) as { workflow_runs?: GithubWorkflowRun[] };
    return Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
  }
}
