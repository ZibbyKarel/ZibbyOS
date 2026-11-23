import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GH_AUDIT_DIR_ENV, githubAuditFile, installGithubFetchAudit } from "./github-audit";

describe("installGithubFetchAudit", () => {
  const realFetch = globalThis.fetch;
  let dir: string;
  let stub: ReturnType<typeof vi.fn>;

  const lines = (): Record<string, unknown>[] => {
    try {
      return readFileSync(githubAuditFile(), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    } catch {
      return [];
    }
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "gh-audit-"));
    process.env[GH_AUDIT_DIR_ENV] = dir;
    stub = vi.fn();
    globalThis.fetch = stub as unknown as typeof fetch;
    installGithubFetchAudit();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env[GH_AUDIT_DIR_ENV];
    rmSync(dir, { recursive: true, force: true });
  });

  it("logs a github request with rate-limit headers, gql, hashed token and caller", async () => {
    stub.mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "x-ratelimit-remaining": "4321", "x-ratelimit-resource": "graphql" },
      }),
    );
    await fetch("https://api.github.com/graphql?x=1", {
      method: "POST",
      headers: { Authorization: "Bearer secret-token" },
      body: JSON.stringify({ query: "query   Foo { viewer { login } }" }),
    });
    const [line] = lines();
    expect(line).toMatchObject({
      src: "fetch",
      method: "POST",
      path: "/graphql",
      query: "?x=1",
      status: 200,
      rlRemaining: 4321,
      rlResource: "graphql",
      gql: "query Foo { viewer { login } }",
    });
    expect(line?.token).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(line)).not.toContain("secret-token");
    expect(line?.caller).toEqual(
      expect.arrayContaining([expect.stringContaining("github-audit.test.ts")]),
    );
  });

  it("logs nothing for non-github hosts", async () => {
    stub.mockResolvedValue(new Response("ok"));
    await fetch("https://example.com/x");
    expect(lines()).toHaveLength(0);
  });

  it("propagates a network failure and logs the error", async () => {
    stub.mockRejectedValue(new Error("boom"));
    await expect(fetch("https://api.github.com/user")).rejects.toThrow("boom");
    expect(lines()[0]).toMatchObject({ path: "/user", error: "boom" });
  });
});
