import * as fs from "node:fs/promises";
import * as path from "node:path";
import { sleep } from "./retry";

/** Why: iCloud Drive evicts "dataless" files (recipes, vault). The first read triggers a
 * download and fails with ETIMEDOUT while it is in flight — at boot that rejected a store's
 * `onModuleInit` and the API never came up. Reading them up-front with retry fixes it. */
export interface HydrateOptions {
  /** Give up on a single file after this long. Default 5 min. */
  timeoutMs?: number;
  retryDelayMs?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface HydrateResult {
  total: number;
  failed: string[];
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".obsidian", ".Trash"]);

async function listFiles(dir: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function isTransient(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ETIMEDOUT" || code === "EAGAIN" || code === "EINTR" || code === "EDEADLK";
}

async function touch(
  file: string,
  opts: Required<Pick<HydrateOptions, "timeoutMs" | "retryDelayMs">>,
) {
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    try {
      const handle = await fs.open(file, "r");
      try {
        // Draining the file forces the full download (one byte may not).
        await handle.readFile();
      } finally {
        await handle.close();
      }
      return;
    } catch (error) {
      if (!isTransient(error) || Date.now() >= deadline) throw error;
      await sleep(opts.retryDelayMs);
    }
  }
}

/** Read every file under `dirs` so iCloud materialises them; never throws. */
export async function hydrateDirs(
  dirs: string[],
  options: HydrateOptions = {},
): Promise<HydrateResult> {
  const files: string[] = [];
  for (const dir of new Set(dirs)) await listFiles(dir, files);
  const opts = {
    timeoutMs: options.timeoutMs ?? 300_000,
    retryDelayMs: options.retryDelayMs ?? 2000,
  };
  const failed: string[] = [];
  let done = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const file = files[next++];
      if (!file) break;
      try {
        await touch(file, opts);
      } catch {
        failed.push(file);
      }
      options.onProgress?.(++done, files.length);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 8 }, worker));
  return { total: files.length, failed };
}
