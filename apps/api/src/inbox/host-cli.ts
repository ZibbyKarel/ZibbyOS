/** The part of a git-host link the prompt snippets need (a `GitHostLink` fits). */
export type HostCliLink =
  | { kind: "github"; repo: string }
  | { kind: "gitlab"; host: string; repo: string };

/** The GitLab write surface every GitLab prompt forbids (the `gh` writes are named per prompt). */
export const glabWrites =
  "any `glab` write: `glab mr note|approve|merge|update|close|create`, `glab ci retry|run|cancel`, mutating `glab api`";

export interface HostCli {
  /** "GitHub" / "GitLab". */
  hostName: string;
  /** "GitHub Actions" / "GitLab CI". */
  ciName: string;
  /** "pull request" / "merge request". */
  prNoun: string;
  /** `owner/name#7` / `group/sub/name!7`. */
  ref(n: number): string;
  /** The bare diff command, for "lines of `<cmd>`" wording. */
  diffCommand: string;
  prView(n: number): string;
  prDiff(n: number): string;
  /** Checks the PR out (GitHub: detached). */
  prCheckout(n: number): string;
  /** Prints the PR head commit sha. */
  headSha(n: number): string;
  /** Lists the PR's CI state (GitLab: the pipeline of `branch`, else of the checked-out branch). */
  checks(n: number, branch?: string): string;
  /** Prints a failed CI job's log. */
  failedLog: string;
}

/**
 * CLI snippets for agent prompts. The GitHub strings are the ones the prompts always carried
 * (byte-identical); the GitLab ones are the `glab` equivalents, `-R <host>/<path>`.
 */
export function hostCli(link: HostCliLink): HostCli {
  if (link.kind === "github") {
    const { repo } = link;
    return {
      hostName: "GitHub",
      ciName: "GitHub Actions",
      prNoun: "pull request",
      ref: (n) => `${repo}#${n}`,
      diffCommand: "gh pr diff",
      prView: (n) => `gh pr view ${n} --repo ${repo}`,
      prDiff: (n) => `gh pr diff ${n} --repo ${repo}`,
      prCheckout: (n) => `gh pr checkout ${n} --repo ${repo} --detach`,
      headSha: (n) => `gh pr view ${n} --repo ${repo} --json headRefOid -q .headRefOid`,
      checks: (n) => `gh pr checks ${n} --repo ${repo}`,
      failedLog: `gh run view <run-id> --repo ${repo} --log-failed`,
    };
  }
  const r = `-R ${link.host}/${link.repo}`;
  return {
    hostName: "GitLab",
    ciName: "GitLab CI",
    prNoun: "merge request",
    ref: (n) => `${link.repo}!${n}`,
    diffCommand: "glab mr diff",
    prView: (n) => `glab mr view ${n} ${r}`,
    prDiff: (n) => `glab mr diff ${n} ${r}`,
    prCheckout: (n) => `glab mr checkout ${n} ${r}`,
    headSha: (n) => `glab mr view ${n} ${r} --output json --jq .sha`,
    checks: (_n, branch) => `glab ci status${branch ? ` --branch ${branch}` : ""} ${r}`,
    failedLog: `glab ci trace <job-id> ${r}`,
  };
}
