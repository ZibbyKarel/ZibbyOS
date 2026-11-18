import { describe, expect, it, vi } from "vitest";
import { GitlabApiError, GitlabClient, type GitlabExecImpl, projectPath } from "./gitlab-client";

function client(impl: GitlabExecImpl) {
  const exec = vi.fn(impl);
  return { exec, gl: new GitlabClient(exec) };
}
const ok = (stdout: string) => async () => ({ stdout, stderr: "" });
const fail = (props: Record<string, unknown>) => async () => {
  throw Object.assign(new Error("Command failed"), props);
};

describe("GitlabClient", () => {
  it("runs glab api with an argv array and parses JSON", async () => {
    const { exec, gl } = client(ok('{"id":1}'));
    await expect(gl.api("gitlab.example.com", "user")).resolves.toEqual({ id: 1 });
    expect(exec.mock.calls[0]?.slice(0, 2)).toEqual([
      "glab",
      ["api", "user", "--hostname", "gitlab.example.com"],
    ]);
    expect(exec.mock.calls[0]?.[2].input).toBeUndefined();
  });

  it("adds method, paginate, and sends the body on stdin", async () => {
    const { exec, gl } = client(ok("[]"));
    await gl.api("h", "p", { method: "POST", paginate: true, body: { a: "x y" } });
    const [, args, opts] = exec.mock.calls[0] ?? [];
    expect(args).toEqual([
      "api",
      "p",
      "--hostname",
      "h",
      "-X",
      "POST",
      "--paginate",
      "--input",
      "-",
      "-H",
      "Content-Type: application/json",
    ]);
    expect(opts?.input).toBe('{"a":"x y"}');
  });

  it("empty stdout is undefined; non-JSON stdout is a GitlabApiError, never a guess", async () => {
    await expect(client(ok("  \n")).gl.api("h", "p")).resolves.toBeUndefined();
    for (const out of ["[1,2]\n[3]", "<html>oops</html>"]) {
      const err = await client(ok(out))
        .gl.api("h", "p")
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(GitlabApiError);
      expect(err).toMatchObject({ message: "glab returned non-JSON output" });
    }
  });

  it("reads the status from the bare `glab: HTTP 404` form", async () => {
    const { gl } = client(fail({ stderr: "glab: HTTP 404\n" }));
    await expect(gl.api("h", "p")).rejects.toMatchObject({ status: 404 });
  });

  it("a 401 carries the login hint for the host", async () => {
    const { gl } = client(fail({ stderr: "glab: 401 Unauthorized (HTTP 401)\n" }));
    await expect(gl.api("gitlab.example.com", "user")).rejects.toMatchObject({
      status: 401,
      message:
        "glab: 401 Unauthorized (HTTP 401) — run `glab auth login --hostname gitlab.example.com`",
    });
  });

  it("a killed / timed-out call says so", async () => {
    for (const props of [{ killed: true, signal: "SIGTERM" }, { code: "ETIMEDOUT" }]) {
      const { gl } = client(fail(props));
      await expect(gl.api("h", "p")).rejects.toMatchObject({
        status: undefined,
        message: "glab timed out after 60 s",
      });
    }
  });

  it("raw returns the text untouched", async () => {
    await expect(client(ok("line1\nline2")).gl.raw("h", "jobs/1/trace")).resolves.toBe(
      "line1\nline2",
    );
  });

  it("maps glab stderr to GitlabApiError with the HTTP status", async () => {
    const { gl } = client(
      fail({ stderr: "glab: 404 Project Not Found (HTTP 404)\n", stdout: '{"message":"x"}' }),
    );
    const err = await gl.api("h", "p").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitlabApiError);
    expect(err).toMatchObject({ status: 404, message: "glab: 404 Project Not Found (HTTP 404)" });
  });

  it("a missing binary has no status and a clear message", async () => {
    const { gl } = client(fail({ code: "ENOENT" }));
    const err = await gl.raw("h", "p").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitlabApiError);
    expect(err).toMatchObject({
      status: undefined,
      message: "glab is not installed or not on PATH",
    });
  });

  it("a network failure has no status", async () => {
    const { gl } = client(fail({ stderr: "ERROR\n no such host" }));
    await expect(gl.api("h", "p")).rejects.toMatchObject({ status: undefined });
  });

  it("projectPath url-encodes the full path", () => {
    expect(projectPath("a/b/c")).toBe("projects/a%2Fb%2Fc");
    expect(new GitlabClient(vi.fn()).projectPath("a/b")).toBe("projects/a%2Fb");
  });
});
