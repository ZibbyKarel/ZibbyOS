import { execFile } from "node:child_process";
import { Injectable, Optional } from "@nestjs/common";
import { agentBaseEnv } from "../shared/agent-env";

/** A failed `glab api` call. `status` is the HTTP status parsed from glab's stderr (absent for a missing binary / network error). */
export class GitlabApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GitlabApiError";
  }
}

export interface GitlabExecOptions {
  /** Written to the child's stdin, then closed. */
  input?: string;
  timeout: number;
  maxBuffer: number;
}

/** The slice of `execFile` this client needs — injectable so tests never run the real `glab`. */
export type GitlabExecImpl = (
  file: string,
  args: string[],
  options: GitlabExecOptions,
) => Promise<{ stdout: string; stderr: string }>;

/** Bounds one `glab api` call; `--paginate` of a big list is the slow case. */
const GLAB_TIMEOUT_MS = 60_000;
const GLAB_MAX_BUFFER = 64 * 1024 * 1024;

const defaultExec: GitlabExecImpl = (file, args, { input, ...options }) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      { ...options, env: agentBaseEnv() },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
    child.stdin?.on("error", () => undefined); // EPIPE when the child exits before reading
    child.stdin?.end(input);
  });

export interface GitlabApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** JSON body, sent on stdin (`--input -`). */
  body?: unknown;
  paginate?: boolean;
}

/** `projects/<url-encoded full path>` — the GitLab project id form used in every API path. */
export function projectPath(repo: string): string {
  return `projects/${encodeURIComponent(repo)}`;
}

/**
 * glab prints `glab: 404 Project Not Found (HTTP 404)` on stderr, or just `glab: HTTP 404`
 * when the body is `{"error":…}`.
 */
function statusOf(stderr: string): number | undefined {
  const m = /\bHTTP (\d{3})\b/.exec(stderr) ?? /^glab: (\d{3})\b/m.exec(stderr);
  return m?.[1] ? Number(m[1]) : undefined;
}

/**
 * Every GitLab call in the app goes through here: `glab api <path> --hostname <host>`,
 * argv-only (no shell). The CLI holds the auth, so there is no token in ZibbyOS.
 */
@Injectable()
export class GitlabClient {
  private readonly execImpl: GitlabExecImpl;

  constructor(@Optional() execImpl?: GitlabExecImpl) {
    this.execImpl = execImpl ?? defaultExec;
  }

  /** JSON call; empty stdout resolves to `undefined`. */
  async api<T = unknown>(host: string, path: string, opts: GitlabApiOptions = {}): Promise<T> {
    const stdout = await this.run(host, path, opts);
    return parseJson(stdout) as T;
  }

  /** Non-JSON body (job trace, raw file, raw diff). */
  raw(host: string, path: string): Promise<string> {
    return this.run(host, path, {});
  }

  projectPath = projectPath;

  private async run(host: string, path: string, opts: GitlabApiOptions): Promise<string> {
    const args = ["api", path, "--hostname", host];
    if (opts.method) args.push("-X", opts.method);
    if (opts.paginate) args.push("--paginate");
    const input = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    if (input !== undefined) args.push("--input", "-", "-H", "Content-Type: application/json");
    try {
      const { stdout } = await this.execImpl("glab", args, {
        ...(input !== undefined ? { input } : {}),
        timeout: GLAB_TIMEOUT_MS,
        maxBuffer: GLAB_MAX_BUFFER,
      });
      return stdout;
    } catch (err) {
      throw toApiError(err, host);
    }
  }
}

/** The fix for a missing/expired glab login, appended to auth failures. */
export const glabLoginHint = (host: string) => `run \`glab auth login --hostname ${host}\``;

function toApiError(err: unknown, host: string): GitlabApiError {
  if (err instanceof GitlabApiError) return err;
  const e = err as { code?: unknown; killed?: unknown; stderr?: unknown; message?: unknown };
  if (e.code === "ENOENT") return new GitlabApiError("glab is not installed or not on PATH");
  if (e.killed === true || e.code === "ETIMEDOUT") {
    return new GitlabApiError(`glab timed out after ${GLAB_TIMEOUT_MS / 1000} s`);
  }
  const stderr = typeof e.stderr === "string" ? e.stderr : "";
  const detail = (stderr.trim() || String(e.message ?? "glab failed")).split("\n")[0] ?? "";
  const status = statusOf(stderr);
  const message = detail.slice(0, 300);
  return new GitlabApiError(
    status === 401 ? `${message} — ${glabLoginHint(host)}` : message,
    status,
  );
}

/** glab `--paginate` prints one merged array; anything that is not JSON is an error, never a guess. */
function parseJson(stdout: string): unknown {
  const text = stdout.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new GitlabApiError("glab returned non-JSON output");
  }
}
