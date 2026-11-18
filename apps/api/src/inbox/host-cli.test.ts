import { describe, expect, it } from "vitest";
import { hostCli } from "./host-cli";

describe("hostCli", () => {
  it("GitHub keeps the gh snippets the prompts always carried", () => {
    const cli = hostCli({ kind: "github", repo: "acme/app" });
    expect(cli).toMatchObject({
      hostName: "GitHub",
      ciName: "GitHub Actions",
      failedLog: "gh run view <run-id> --repo acme/app --log-failed",
    });
    expect(cli.ref(7)).toBe("acme/app#7");
    expect(cli.prView(7)).toBe("gh pr view 7 --repo acme/app");
    expect(cli.prDiff(7)).toBe("gh pr diff 7 --repo acme/app");
    expect(cli.prCheckout(7)).toBe("gh pr checkout 7 --repo acme/app --detach");
    expect(cli.checks(7)).toBe("gh pr checks 7 --repo acme/app");
  });

  it("GitLab uses glab with -R <host>/<path>", () => {
    const cli = hostCli({ kind: "gitlab", host: "gl.example.com", repo: "g/sub/app" });
    expect(cli).toMatchObject({
      hostName: "GitLab",
      ciName: "GitLab CI",
      prNoun: "merge request",
      failedLog: "glab ci trace <job-id> -R gl.example.com/g/sub/app",
    });
    expect(cli.ref(7)).toBe("g/sub/app!7");
    expect(cli.prView(7)).toBe("glab mr view 7 -R gl.example.com/g/sub/app");
    expect(cli.prDiff(7)).toBe("glab mr diff 7 -R gl.example.com/g/sub/app");
    expect(cli.prCheckout(7)).toBe("glab mr checkout 7 -R gl.example.com/g/sub/app");
    expect(cli.checks(7)).toBe("glab ci status -R gl.example.com/g/sub/app");
    expect(cli.checks(7, "feat")).toBe("glab ci status --branch feat -R gl.example.com/g/sub/app");
  });
});
