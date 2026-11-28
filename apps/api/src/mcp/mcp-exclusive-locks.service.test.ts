import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@zibby/contracts";
import { McpExclusiveLocksService } from "./mcp-exclusive-locks.service";

const server = (id: string, args: string[] = [], exclusive?: boolean): McpServer => ({
  id,
  type: "stdio",
  command: "/bin/sh",
  args,
  enabled: true,
  hasCredentials: false,
  ...(exclusive === undefined ? {} : { exclusive }),
});

function make(servers: McpServer[] = []) {
  return new McpExclusiveLocksService({ list: async () => servers } as never);
}

describe("McpExclusiveLocksService", () => {
  it("resolves the exclusive servers a tool list names", async () => {
    const locks = make([
      server("pw-mw", ["--user-data-dir", "/p"]),
      server("pw-plain", ["--headless"]),
      server("custom", [], true),
    ]);
    expect(await locks.exclusiveServersFor(["Read", "mcp__pw-mw__*", "mcp__pw-plain__x"])).toEqual([
      "pw-mw",
    ]);
    expect(await locks.exclusiveServersFor(["custom"])).toEqual(["custom"]);
    expect(await locks.exclusiveServersFor([])).toEqual([]);
  });

  it("degrades to no locks when the registry cannot be listed", async () => {
    const locks = new McpExclusiveLocksService({
      list: async () => {
        throw new Error("boom");
      },
    } as never);
    expect(await locks.exclusiveServersFor(["mcp__a__*"])).toEqual([]);
  });

  it("grants waiters FIFO and release is idempotent", async () => {
    const locks = make();
    const order: string[] = [];
    const first = await locks.acquire(["a"]);
    const p2 = locks.acquire(["a"]).then((r) => (order.push("2"), r));
    const p3 = locks.acquire(["a"]).then((r) => (order.push("3"), r));
    await Promise.resolve();
    expect(order).toEqual([]);
    first();
    first(); // idempotent: must not free the next holder's lock
    const second = await p2;
    expect(order).toEqual(["2"]);
    expect(locks.isFree(["a"])).toBe(false);
    second();
    (await p3)();
    expect(locks.isFree(["a"])).toBe(true);
  });

  it("does not let a later waiter jump an earlier one wanting the same server", async () => {
    const locks = make();
    const holdA = await locks.acquire(["a"]);
    const order: string[] = [];
    const wantAB = locks.acquire(["a", "b"]).then((r) => (order.push("ab"), r));
    const wantB = locks.acquire(["b"]).then((r) => (order.push("b"), r));
    await Promise.resolve();
    expect(order).toEqual([]); // b is free but reserved for the earlier [a,b] waiter
    holdA();
    const ab = await wantAB;
    expect(order).toEqual(["ab"]);
    ab();
    (await wantB)();
    expect(order).toEqual(["ab", "b"]);
  });

  it("tryAcquire is non-blocking and onFreed fires on release", () => {
    const locks = make();
    const freed = vi.fn();
    locks.onFreed(freed);
    const release = locks.tryAcquire(["a"]);
    expect(release).not.toBeNull();
    expect(locks.tryAcquire(["a"])).toBeNull();
    release?.();
    expect(freed).toHaveBeenCalledTimes(1);
    expect(locks.tryAcquire(["a"])).not.toBeNull();
  });

  it("an empty id list is a free no-op", async () => {
    const locks = make();
    expect(locks.isFree([])).toBe(true);
    (await locks.acquire([]))();
  });
});
