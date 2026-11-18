import { GitlabApiError, type GitlabClient } from "../git-host/gitlab-client";
import { type GitlabLink, readGitlabViewer, unavailable } from "./inbox.gitlab";
import { codeOwnersOf } from "./pr-reviewers";
import type { ReviewScope } from "./code-owners.service";

/** GitLab's lookup order; the first file found is the only one used. */
export const GITLAB_CODEOWNERS_PATHS = [
  "CODEOWNERS",
  "docs/CODEOWNERS",
  ".gitlab/CODEOWNERS",
] as const;

/** `[Section]`, `^[Optional]`, `[Section][2]`, each optionally followed by default owners. */
const SECTION_HEADER = /^\^?\[([^\]]+)\](?:\[\d+\])?((?:\s+\S+)*)\s*$/;

/**
 * GitLab CODEOWNERS → one GitHub-syntax text per section (header dropped, the section's default
 * owners appended to entries that name none). Sections of the same name merge, case-insensitively;
 * entries before any header form the unnamed section.
 */
function sectionTexts(text: string): string[] {
  const sections = new Map<string, string[]>([["", []]]);
  let current = "";
  let defaults: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const header = SECTION_HEADER.exec(line);
    if (header?.[1]) {
      current = header[1].trim().toLowerCase();
      defaults = (header[2] ?? "").split(/\s+/).filter(Boolean);
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    const parts = line.split(/\s+/);
    sections.get(current)?.push(parts.length === 1 ? [...parts, ...defaults].join(" ") : line);
  }
  return [...sections.values()].map((lines) => lines.join("\n"));
}

/**
 * Owners GitLab assigns to `path`: inside each section the last matching entry wins, and the
 * owners of every section add up (a section is its own approval rule).
 * ponytail: `@@role` owners and emails come through as plain tokens, never "mine"; entries with an escaped space never match.
 */
export function gitlabCodeOwnersOf(text: string, path: string): string[] {
  return [...new Set(sectionTexts(text).flatMap((section) => codeOwnersOf(section, path)))];
}

/** `@group/sub` owners (a slash); a bare `@name` is a user. ponytail: a top-level group owner reads as a user. */
export const isGroupOwner = (owner: string): boolean =>
  owner.startsWith("@") && owner.includes("/");

/** First CODEOWNERS file at `ref` (default branch when absent); a 404 means the next spot, none means `undefined`. */
export async function readGitlabCodeowners(
  client: GitlabClient,
  link: GitlabLink,
  ref: string | undefined,
): Promise<{ path: string; text: string; ref: string } | undefined> {
  const project = client.projectPath(link.repo);
  const branch =
    ref ?? (await client.api<{ default_branch?: string }>(link.host, project)).default_branch;
  if (!branch) return undefined;
  for (const path of GITLAB_CODEOWNERS_PATHS) {
    try {
      const text = await client.raw(
        link.host,
        `${project}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`,
      );
      return { path, text, ref: branch };
    } catch (error) {
      if (!(error instanceof GitlabApiError) || error.status !== 404) throw error;
    }
  }
  return undefined;
}

export interface GitlabMember {
  username?: string;
  state?: string;
  access_level?: number;
}

/** Direct + inherited members of a group (`@group/sub` owners); an inaccessible group has none. */
export async function readGitlabGroupMembers(
  client: GitlabClient,
  host: string,
  group: string,
): Promise<GitlabMember[]> {
  return (
    (await client
      .api<
        GitlabMember[] | undefined
      >(host, `groups/${encodeURIComponent(group)}/members/all?per_page=100`, { paginate: true })
      .catch(unavailable<GitlabMember[] | undefined>([]))) ?? []
  );
}

/** Direct + inherited members of the project. */
export async function readGitlabProjectMembers(
  client: GitlabClient,
  link: GitlabLink,
): Promise<GitlabMember[]> {
  return (
    (await client.api<GitlabMember[] | undefined>(
      link.host,
      `${client.projectPath(link.repo)}/members/all?per_page=100`,
      { paginate: true },
    )) ?? []
  );
}

/** Developer (30) and up can review; blocked/deactivated accounts cannot. */
export const canReview = (m: GitlabMember): boolean =>
  (m.access_level ?? 0) >= 30 && (m.state === undefined || m.state === "active");

/** Cache hook: runs `load` once per key within a TTL (the service supplies it). */
export type Memo = <T>(key: string, load: () => Promise<T>) => Promise<T>;

/**
 * Which changed files a ZIBBY review covers on a GitLab MR — same contract as the GitHub
 * `reviewScope` (the caller wraps it in the same fail-open catch).
 */
export async function gitlabReviewScope(
  client: GitlabClient,
  memo: Memo,
  link: GitlabLink,
  baseRef: string | undefined,
  files: readonly { filename: string; previousFilename?: string }[],
): Promise<ReviewScope> {
  const at = `${link.repo}@${baseRef ?? "default branch"}`;
  const file = await memo(`gitlab\n${link.host}\n${at}`, () =>
    readGitlabCodeowners(client, link, baseRef),
  );
  if (!file) return { kind: "all", reason: `no CODEOWNERS in ${at}` };
  const me = (link.username ?? (await readGitlabViewer(client, link.host)))?.toLowerCase();
  if (!me) throw new Error("gitlab: no logged-in user");
  const ownersOf = (f: { filename: string; previousFilename?: string }) =>
    [f.filename, f.previousFilename].flatMap((p) => (p ? gitlabCodeOwnersOf(file.text, p) : []));
  const groups = new Set(files.flatMap(ownersOf).filter(isGroupOwner));
  const inGroup = new Map<string, boolean>();
  await Promise.all(
    [...groups].map(async (owner) => {
      const group = owner.slice(1);
      const members = await memo(`gitlab-group\n${link.host}\n${group}`, () =>
        readGitlabGroupMembers(client, link.host, group),
      );
      inGroup.set(
        owner,
        members.some((m) => m.username?.toLowerCase() === me),
      );
    }),
  );
  const isMine = (owner: string) =>
    isGroupOwner(owner) ? inGroup.get(owner) === true : owner.slice(1).toLowerCase() === me;
  const owners = new Set<string>();
  const mine = files
    .filter((f) => {
      const hits = ownersOf(f).filter((o) => o.startsWith("@") && isMine(o));
      for (const o of hits) owners.add(o);
      return hits.length > 0;
    })
    .map((f) => f.filename);
  const source = `${file.path}@${file.ref}`;
  if (mine.length === 0) return { kind: "none", files: files.length, source };
  if (mine.length === files.length)
    return { kind: "all", reason: "every changed file is owned by you or your groups" };
  return {
    kind: "mine",
    files: mine,
    outOfScope: files.length - mine.length,
    owners: [...owners],
    source,
  };
}
