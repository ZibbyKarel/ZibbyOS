type UrlLink = { kind: "github"; repo: string } | { kind: "gitlab"; host: string; repo: string };

function base(link: UrlLink): string {
  return link.kind === "github"
    ? `https://github.com/${link.repo}`
    : `https://${link.host}/${link.repo}`;
}

export function prWebUrl(link: UrlLink, number: number): string {
  return link.kind === "github"
    ? `${base(link)}/pull/${number}`
    : `${base(link)}/-/merge_requests/${number}`;
}

export function issueWebUrl(link: UrlLink, number: number): string {
  return link.kind === "github"
    ? `${base(link)}/issues/${number}`
    : `${base(link)}/-/issues/${number}`;
}

/** A GitHub `/pull/N` or GitLab `/-/merge_requests/N` URL → host, repo path, number. */
export function parsePrUrl(
  url: string,
): { host: string; repo: string; number: number; kind: "github" | "gitlab" } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const gl = /^\/(.+?)\/-\/merge_requests\/(\d+)(?:\/|$)/.exec(u.pathname);
  if (gl?.[1] && gl[2])
    return { host: u.host.toLowerCase(), repo: gl[1], number: Number(gl[2]), kind: "gitlab" };
  const gh = /^\/([^/]+\/[^/]+)\/pull\/(\d+)(?:\/|$)/.exec(u.pathname);
  if (gh?.[1] && gh[2])
    return { host: u.host.toLowerCase(), repo: gh[1], number: Number(gh[2]), kind: "github" };
  return null;
}

export function parsePrNumber(url: string): number | null {
  return parsePrUrl(url)?.number ?? null;
}
