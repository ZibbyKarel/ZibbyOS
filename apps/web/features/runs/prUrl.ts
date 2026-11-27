/** A GitHub pull request or GitLab merge request URL (`…/pull/12`, `…/-/merge_requests/3`). */
const PR_URL = /https?:\/\/[^\s"'<>()[\]]+?\/(?:pull|merge_requests)\/\d+/g;

/**
 * The last PR/MR URL in `text` — what `gh pr create` / `glab mr create` prints once the PR exists.
 * ponytail: last match wins, so a log that merely mentions another PR after opening its own
 * would mislead; tighten to the line after a create command if that ever shows up.
 */
export function findPrUrl(text: string | undefined): string | undefined {
  return text?.match(PR_URL)?.at(-1);
}
