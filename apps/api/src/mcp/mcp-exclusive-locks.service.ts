import { Injectable } from "@nestjs/common";
import { type McpServer, isExclusiveMcpServer } from "@zibby/contracts";
import { McpServersStorageService } from "./mcp.storage.service";

/** Does a tools/grants list name MCP server `id` (bare id, `mcp__<id>`, `mcp__<id>__…`)? */
function names(tools: readonly string[], id: string): boolean {
  return tools.some((t) => t === id || t === `mcp__${id}` || t.startsWith(`mcp__${id}__`));
}

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  return a.some((id) => b.includes(id));
}

interface Waiter {
  ids: string[];
  grant: () => void;
}

/**
 * A per-MCP-server mutex for servers that admit ONE user at a time — a Playwright
 * server on a persistent `--user-data-dir` profile crashes a second browser
 * ("Browser is already in use"). A stage or run whose agent tools name such a server
 * takes its lock for the stage's lifetime; the rest wait FIFO (queued, not failed).
 * Several ids are taken atomically (no partial hold, so no lock-order deadlock), and
 * an earlier waiter's ids stay reserved so a later one cannot jump it.
 *
 * In-memory by design: an API restart clears every lock (the children died with it);
 * holders release in `finally` / on their terminal status, so a crashed holder never
 * leaks one.
 */
@Injectable()
export class McpExclusiveLocksService {
  private readonly held = new Set<string>();
  private readonly waiters: Waiter[] = [];
  private readonly freedListeners = new Set<() => void>();

  constructor(private readonly servers: McpServersStorageService) {}

  /** The exclusive registry servers `tools` reference, sorted. A listing failure → none. */
  async exclusiveServersFor(tools: readonly string[]): Promise<string[]> {
    if (tools.length === 0) return [];
    const registry = await this.servers.list().catch((): McpServer[] => []);
    return registry
      .filter((s) => s.enabled && isExclusiveMcpServer(s) && names(tools, s.id))
      .map((s) => s.id)
      .sort();
  }

  /** True when every id is unheld and not reserved for an earlier waiter. */
  isFree(ids: readonly string[]): boolean {
    return ids.every((id) => !this.held.has(id)) && !this.waiters.some((w) => overlaps(w.ids, ids));
  }

  /** Take the locks now, or null when any is busy. Never waits. */
  tryAcquire(ids: readonly string[]): (() => void) | null {
    if (!this.isFree(ids)) return null;
    return this.take(ids);
  }

  /** Take the locks, waiting FIFO behind earlier holders/waiters. Resolves to the release. */
  acquire(ids: readonly string[]): Promise<() => void> {
    const free = this.tryAcquire(ids);
    if (free) return Promise.resolve(free);
    return new Promise((resolve) => {
      this.waiters.push({ ids: [...ids], grant: () => resolve(this.take(ids)) });
    });
  }

  /** Subscribe to "a lock freed"; returns the unsubscribe. */
  onFreed(listener: () => void): () => void {
    this.freedListeners.add(listener);
    return () => this.freedListeners.delete(listener);
  }

  private take(ids: readonly string[]): () => void {
    for (const id of ids) this.held.add(id);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const id of ids) this.held.delete(id);
      this.promote();
      for (const listener of this.freedListeners) listener();
    };
  }

  /** Grant waiters in order; a blocked waiter reserves its ids against later ones. */
  private promote(): void {
    const reserved = new Set<string>();
    for (let i = 0; i < this.waiters.length; ) {
      const w = this.waiters[i] as Waiter;
      if (w.ids.every((id) => !this.held.has(id) && !reserved.has(id))) {
        this.waiters.splice(i, 1);
        w.grant();
      } else {
        for (const id of w.ids) reserved.add(id);
        i += 1;
      }
    }
  }
}
