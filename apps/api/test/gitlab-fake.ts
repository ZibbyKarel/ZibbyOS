import { vi } from "vitest";
import { GitlabClient, type GitlabExecImpl } from "../src/git-host/gitlab-client";

type Handler = (args: string[], input?: string) => unknown;

/**
 * A fake `glab`: the first route whose pattern matches the decoded API path answers; the rest 404.
 * A reply is JSON, `{ raw }` (non-JSON body), `{ status }` (the call fails with that HTTP status),
 * or a function returning one of those.
 */
export function fakeGlab(routes: [RegExp, unknown][]) {
  const exec = vi.fn<GitlabExecImpl>(async (_file, args, options) => {
    const path = decodeURIComponent(args[1] ?? "");
    const hit = routes.find(([re]) => re.test(path))?.[1];
    const reply: unknown =
      hit === undefined
        ? { status: 404 }
        : typeof hit === "function"
          ? (hit as Handler)(args, options.input)
          : hit;
    if (reply && typeof reply === "object" && "status" in reply) {
      const { status } = reply as { status: number };
      throw Object.assign(new Error("glab failed"), {
        stderr: `glab: ${status} Error (HTTP ${status})`,
      });
    }
    if (reply && typeof reply === "object" && "raw" in reply)
      return { stdout: (reply as { raw: string }).raw, stderr: "" };
    return { stdout: JSON.stringify(reply), stderr: "" };
  });
  const paths = () => exec.mock.calls.map(([, args]) => decodeURIComponent(args[1] ?? ""));
  return { exec, client: new GitlabClient(exec), paths };
}
