import { describe, expect, it } from "vitest";
import {
  type RoutableProject,
  RoutingMatchSchema,
  gitRemoteInfo,
  githubRepoFor,
  gitlabRepoFor,
  matchRouting,
  repoFromGitRemote,
} from "./integration-routing";
import { isGitlabShape } from "./integration.schema";

describe("RoutingMatchSchema", () => {
  it("requires jql or projectKey for jira", () => {
    expect(RoutingMatchSchema.safeParse({ kind: "jira", labels: ["x"] }).success).toBe(false);
    expect(RoutingMatchSchema.safeParse({ kind: "jira", projectKey: "ABC" }).success).toBe(true);
    expect(RoutingMatchSchema.safeParse({ kind: "jira", jql: "project = A" }).success).toBe(true);
  });
  it("accepts github with no config and slack with >=1 channel", () => {
    expect(RoutingMatchSchema.safeParse({ kind: "github" }).success).toBe(true);
    expect(RoutingMatchSchema.safeParse({ kind: "slack", channels: [] }).success).toBe(false);
    expect(RoutingMatchSchema.safeParse({ kind: "slack", channels: ["C1"] }).success).toBe(true);
  });
});

describe("repoFromGitRemote", () => {
  it.each([
    ["git@github.com:Shoptet/cms4.git", "shoptet/cms4"],
    ["https://github.com/shoptet/partner-cli", "shoptet/partner-cli"],
    ["ssh://git@github.com/a/b.git", "a/b"],
  ])("%s", (remote, repo) => expect(repoFromGitRemote(remote)).toBe(repo));
  it("returns null for absent/odd input", () => {
    expect(repoFromGitRemote(undefined)).toBeNull();
    expect(repoFromGitRemote("https://example.com/only-one")).toBeNull();
  });
});

const projects: RoutableProject[] = [
  {
    id: "cms4",
    gitRemote: "git@github.com:shoptet/cms4.git",
    integrationRouting: [
      { integrationId: "jira1", match: { kind: "jira", projectKey: "CZ", labels: ["portal"] } },
      { integrationId: "gh", match: { kind: "github" } },
      { integrationId: "sl", match: { kind: "slack", channels: ["C1"] } },
    ],
  },
  {
    id: "cli",
    gitRemote: "https://github.com/shoptet/partner-cli",
    integrationRouting: [
      { integrationId: "jira1", match: { kind: "jira", projectKey: "CZ", labels: ["cli"] } },
      { integrationId: "jira1", match: { kind: "jira", jql: "labels = x", projectKey: "ZZ" } },
    ],
  },
  { id: "none" },
];

describe("matchRouting", () => {
  const jira = (labels: string[], projectKey = "cz") => ({
    integrationId: "jira1",
    kind: "jira" as const,
    jira: { projectKey, components: [], labels },
  });

  it("matches jira by projectKey + any label (case-insensitive)", () => {
    expect(matchRouting(jira(["Portal"]), projects)).toEqual(["cms4"]);
    expect(matchRouting(jira(["cli"]), projects)).toEqual(["cli"]);
  });
  it("returns every match so the caller can triage ambiguity", () => {
    expect(matchRouting(jira(["portal", "cli"]), projects)).toEqual(["cms4", "cli"]);
  });
  it("jql rules match only via jqlMatches", () => {
    const item = jira([], "zz");
    expect(matchRouting(item, projects)).toEqual([]);
    expect(matchRouting(item, projects, new Set(["cli"]))).toEqual(["cli"]);
  });
  it("ignores other integrations and projects without rules", () => {
    expect(matchRouting({ ...jira(["portal"]), integrationId: "other" }, projects)).toEqual([]);
  });
  it("matches github implicitly through the project's gitRemote, no rule needed", () => {
    const item = { integrationId: "gh", kind: "github" as const, github: { repo: "Shoptet/CMS4" } };
    expect(matchRouting(item, projects)).toEqual(["cms4"]);
    expect(matchRouting({ ...item, github: { repo: "shoptet/partner-cli" } }, projects)).toEqual([
      "cli",
    ]);
    expect(matchRouting({ ...item, github: { repo: "shoptet/other" } }, projects)).toEqual([]);
  });
  it("matches slack by channel", () => {
    const item = { integrationId: "sl", kind: "slack" as const, slack: { channel: "C1" } };
    expect(matchRouting(item, projects)).toEqual(["cms4"]);
    expect(matchRouting({ ...item, slack: { channel: "C2" } }, projects)).toEqual([]);
  });
});

describe("githubRepoFor", () => {
  const remote = { gitRemote: "git@github.com:Acme/Web.git" };
  const gh = (repo?: string) => ({
    kind: "github",
    streams: [],
    username: "me",
    ...(repo ? { repo } : {}),
  });
  it("derives the repo from the project's gitRemote only", () => {
    expect(githubRepoFor({ config: gh() }, remote)).toBe("acme/web");
    expect(githubRepoFor({ config: gh() }, {})).toBeNull();
  });
  it("ignores the owner and any config.repo", () => {
    const owned = { companyId: "c", config: gh("acme/api") };
    expect(githubRepoFor(owned, remote)).toBe("acme/web");
    expect(githubRepoFor({ config: gh("acme/api") }, {})).toBeNull();
  });
  it("null for a non-github integration", () => {
    expect(githubRepoFor({ config: { kind: "jira" } }, remote)).toBeNull();
  });
});

describe("githubRepoFor host guard", () => {
  it("does not mistake a two-segment GitLab remote for a GitHub repo", () => {
    const config = { kind: "github", username: "me" };
    expect(
      githubRepoFor({ config }, { gitRemote: "git@gitlab.example.com:acme/web.git" }),
    ).toBeNull();
    expect(githubRepoFor({ config }, { gitRemote: "https://github.com/Acme/Web" })).toBe(
      "acme/web",
    );
  });
});

describe("gitRemoteInfo", () => {
  it.each([
    ["git@github.com:Acme/Web.git", { host: "github.com", path: "Acme/Web" }],
    ["https://github.com/acme/web", { host: "github.com", path: "acme/web" }],
    [
      "https://user@GitLab.Group.Team.Blue/a/b/c.git/",
      { host: "gitlab.group.team.blue", path: "a/b/c" },
    ],
    [
      "ssh://git@gitlab.example.com:2222/g/sub/name.git",
      { host: "gitlab.example.com", path: "g/sub/name" },
    ],
    [
      "git@gitlab.example.com:g/sub/deep/name.git",
      { host: "gitlab.example.com", path: "g/sub/deep/name" },
    ],
    ["https://host.io/onlyone", null],
    ["not a remote", null],
    ["", null],
    [undefined, null],
  ])("%s", (remote, expected) => {
    expect(gitRemoteInfo(remote)).toEqual(expected);
  });
});

describe("isGitlabShape", () => {
  it("accepts a hostname and a nested path, rejects anything else", () => {
    expect(isGitlabShape("gitlab.example.com", "group/sub/project")).toBe(true);
    expect(isGitlabShape("gitlab.example.com:8443", "g/p")).toBe(true);
    for (const [host, repo] of [
      ["gitlab.example.com", "single"],
      ["gitlab.example.com", "g/$(id)/p"],
      ["gitlab.example.com", "g/p; rm -rf"],
      ["gitlab.example.com", undefined],
      ["https://gitlab.example.com", "g/p"],
      ["gitlab.example.com/evil", "g/p"],
      [undefined, "g/p"],
    ] as const) {
      expect(isGitlabShape(host, repo), `${host} ${repo}`).toBe(false);
    }
  });
});

describe("gitlabRepoFor", () => {
  const remote = { gitRemote: "git@gitlab.group.team.blue:shoptet/projects/app.git" };
  const gl = (repo?: string) => ({
    kind: "gitlab",
    host: "gitlab.group.team.blue",
    ...(repo ? { repo } : {}),
  });
  it("null for a host or path that fails the shape check (every producer inherits it)", () => {
    expect(
      gitlabRepoFor({ config: gl() }, { gitRemote: "git@gitlab.group.team.blue:a/`x`/c.git" }),
    ).toBeNull();
    expect(
      gitlabRepoFor({ config: { kind: "gitlab", host: "h/evil" } }, { gitRemote: "git@h:a/b.git" }),
    ).toBeNull();
  });
  it("the remote path when the host matches (case-insensitive)", () => {
    expect(gitlabRepoFor({ config: gl() }, remote)).toBe("shoptet/projects/app");
    expect(gitlabRepoFor({ config: { ...gl(), host: "GitLab.Group.Team.Blue" } }, remote)).toBe(
      "shoptet/projects/app",
    );
  });
  it("ignores the owner and any config.repo", () => {
    const owned = { companyId: "c", config: gl("a/b") };
    expect(gitlabRepoFor(owned, remote)).toBe("shoptet/projects/app");
    expect(gitlabRepoFor({ config: gl("a/b/c") }, {})).toBeNull();
  });
  it("host mismatch or no remote -> null", () => {
    expect(gitlabRepoFor({ config: gl() }, { gitRemote: "git@github.com:a/b.git" })).toBeNull();
    expect(gitlabRepoFor({ config: gl() }, {})).toBeNull();
  });
  it("null for a non-gitlab integration", () => {
    expect(gitlabRepoFor({ config: { kind: "github" } }, remote)).toBeNull();
  });
});
