import { describe, expect, it, vi } from "vitest";
import { appendGithubAudit } from "./github-audit";
import { InvalidGitRemoteError, exec, isValidGitRemote, validateRemote } from "./git-exec";

vi.mock("./github-audit", () => ({ appendGithubAudit: vi.fn() }));

describe("isValidGitRemote / validateRemote (Task 8 — clone remote allowlist)", () => {
  const legit = [
    "https://github.com/acme/alpha.git",
    "ssh://git@github.com/acme/alpha.git",
    "git@github.com:acme/alpha.git",
  ];

  it.each(legit)("accepts %s", (url) => {
    expect(isValidGitRemote(url)).toBe(true);
    expect(() => validateRemote(url)).not.toThrow();
  });

  const malicious: Array<[label: string, url: string]> = [
    ["leading-dash option-injection value", "--upload-pack=/bin/sh"],
    ["leading-dash proxy flag", "-oProxyCommand=x"],
    ["file:// local-path exfil", "file:///etc/passwd"],
    ["ext:: transport RCE", 'ext::sh -c "id"'],
    ["bare local path (no scheme)", "/tmp/x"],
    ["git:// unauthenticated (locked reject)", "git://github.com/x"],
    // CVE-2017-1000117 class: leading-dash authority (host/user) — ssh-option injection.
    ["scp-like leading-dash host (ssh-option injection)", "git@-oProxyCommand:evil"],
    ["ssh:// leading-dash user (ssh-option injection)", "ssh://-oProxyCommand@host/x"],
    ["ssh:// leading-dash host (ssh-option injection)", "ssh://user@-host/x"],
    ["scp-like leading-dash host, short form", "git@-h:path"],
    // Double-`@` bypass: a first-`@` authority split reads the dash-leading
    // segment as part of the userinfo (not the host) and wrongly accepts —
    // ssh itself resolves the host from the LAST `@`, so these must reject.
    ["ssh:// double-@ smuggled dash-host", "ssh://user@evil@-host/x"],
    ["ssh:// double-@ smuggled proxy flag", "ssh://a@b@-oProxyCommand=x/y"],
    ["https:// double-@ smuggled dash-host", "https://user@evil@-host/path"],
  ];

  it.each(malicious)("rejects %s: %s", (_label, url) => {
    expect(isValidGitRemote(url)).toBe(false);
    expect(() => validateRemote(url)).toThrow(InvalidGitRemoteError);
  });

  it("the thrown error carries the offending remote and a stable name", () => {
    try {
      validateRemote('ext::sh -c "id"');
      expect.unreachable("validateRemote should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGitRemoteError);
      expect((error as InvalidGitRemoteError).name).toBe("InvalidGitRemoteError");
      expect((error as InvalidGitRemoteError).remote).toBe('ext::sh -c "id"');
    }
  });
});

describe("exec child env", () => {
  it("never passes the operator token to a git/gh child, but keeps a caller's env", async () => {
    const saved = { ...process.env };
    process.env.ZIBBY_OPERATOR_TOKEN = "secret";
    process.env.ZIBBY_OPERATOR_TOKEN_FILE = "/tmp/x";
    try {
      const { stdout } = await exec(
        "sh",
        [
          "-c",
          'printf "%s|%s|%s" "${ZIBBY_OPERATOR_TOKEN-unset}" "${ZIBBY_OPERATOR_TOKEN_FILE-unset}" "$FOO"',
        ],
        { env: { NODE_ENV: process.env.NODE_ENV, FOO: "bar", ZIBBY_OPERATOR_TOKEN: "again" } },
      );
      expect(stdout).toBe("unset|unset|bar");
    } finally {
      process.env = saved;
    }
  });
});

describe("exec gh audit", () => {
  it("audits a gh call (scrubbed query, caller, error) and preserves the rejection", async () => {
    const audit = vi.mocked(appendGithubAudit);
    audit.mockClear();
    const query = `query=${"x".repeat(300)}`;
    // `gh` may not be installed: either way the call settles and is audited.
    await exec("gh", ["api", "graphql", "-f", query]).catch(() => undefined);
    await vi.waitFor(() => expect(audit).toHaveBeenCalledTimes(1));
    const entry = audit.mock.calls[0]?.[0] as { src: string; args: string[]; caller: string[] };
    expect(entry.src).toBe("gh-exec");
    expect(entry.args[3]).toHaveLength(120);
    expect(entry.caller[0]).toContain("git-exec.test.ts");
    audit.mockClear();
    await exec("sh", ["-c", "true"]);
    expect(audit).not.toHaveBeenCalled();
  });
});
