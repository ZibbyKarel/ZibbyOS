import type { Company, Integration, Project, Team } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { CompanyNotFoundError } from "../companies/companies.errors";
import { ProjectNotFoundError } from "./projects.errors";
import { TeamNotFoundError } from "../teams/teams.errors";
import { ResolvedProjectService } from "./resolved-project.service";

const project = (over: Partial<Project> & Pick<Project, "id">): Project => ({
  name: over.id,
  path: `/work/${over.id}`,
  ...over,
});

const team = (over: Partial<Team> & Pick<Team, "id">): Team => ({
  name: over.id,
  ...over,
});

const integration = (
  over: Partial<Integration> & Pick<Integration, "id" | "kind">,
): Integration => ({
  name: over.id,
  enabled: true,
  status: "disconnected",
  hasCredentials: false,
  config: { kind: "slack", channels: [] },
  ...over,
});

function build(
  opts: {
    companies?: Company[];
    integrations?: Integration[];
    teams?: Team[];
    projects?: Project[];
  } = {},
) {
  const companies = opts.companies ?? [];
  const integrations = opts.integrations ?? [];
  const teams = opts.teams ?? [];
  const projects = opts.projects ?? [];
  const companiesStore = {
    get: async (id: string) => {
      const found = companies.find((c) => c.id === id);
      if (!found) throw new CompanyNotFoundError(id);
      return found;
    },
  };
  const integrationsStore = { list: async () => integrations };
  // Real `TeamsStorageService.get`/`ProjectsStorageService.get` tolerance
  // (throw a NotFound error for an unknown id) — needed so `findTeam`'s
  // `.catch(() => null)` and `knowledgeBaseFor`'s equivalent are exercised
  // against the same shape the real stores throw, not a generic Error.
  const teamsStore = {
    get: async (id: string) => {
      const found = teams.find((t) => t.id === id);
      if (!found) throw new TeamNotFoundError(id);
      return found;
    },
  };
  const projectsStore = {
    list: async () => projects,
    get: async (id: string) => {
      const found = projects.find((p) => p.id === id);
      if (!found) throw new ProjectNotFoundError(id);
      return found;
    },
  };
  return new ResolvedProjectService(
    companiesStore as never,
    integrationsStore as never,
    teamsStore as never,
    projectsStore as never,
  );
}

describe("ResolvedProjectService", () => {
  it("no companyId: returns the project's own raw data (identity)", async () => {
    const service = build();
    const alpha = project({
      id: "alpha",
      identity: { people: [{ id: "bob", name: "Bob", role: "Engineer" }] },
      budget: { dailyRuns: 3 },
    });
    expect(await service.resolvePeople(alpha)).toEqual(alpha.identity?.people);
    expect(await service.resolveBudget(alpha)).toEqual(alpha.budget);
  });

  it("dangling companyId (company deleted): falls back to the project's own raw data, does not throw", async () => {
    const service = build({ companies: [] }); // no "ghost" company exists
    const alpha = project({
      id: "alpha",
      companyId: "ghost",
      identity: { people: [{ id: "bob", name: "Bob", role: "Engineer" }] },
      budget: { dailyRuns: 3 },
    });
    await expect(service.resolvePeople(alpha)).resolves.toEqual(alpha.identity?.people);
    await expect(service.resolveBudget(alpha)).resolves.toEqual(alpha.budget);
    await expect(service.resolveIntegrations(alpha)).resolves.toEqual([]);
    await expect(service.resolve(alpha)).resolves.toEqual({
      people: alpha.identity?.people,
      budget: alpha.budget,
      integrations: [],
    });
  });

  it("a resolving companyId merges the company's roster/budget; its accounts + the operator's project-scoped ones serve", async () => {
    const acme: Company = {
      id: "acme",
      name: "Acme Corp",
      people: [{ id: "alice", name: "Alice", role: "CEO", vip: true }],
      budget: { dailyRuns: 10, weeklyRuns: 50 },
    };
    const service = build({
      companies: [acme],
      integrations: [
        integration({ id: "co-jira", kind: "jira", companyId: "acme" }),
        integration({ id: "co-slack", kind: "slack", companyId: "acme" }),
        integration({ id: "other-slack", kind: "slack", companyId: "other" }),
        integration({ id: "mine-slack", kind: "slack" }),
        integration({ id: "mine-sentry", kind: "sentry" }),
      ],
    });
    const alpha = project({
      id: "alpha",
      companyId: "acme",
      identity: { people: [{ id: "bob", name: "Bob", role: "Engineer" }] },
      budget: { dailyRuns: 3 },
    });

    expect((await service.resolvePeople(alpha)).map((p) => p.id).sort()).toEqual(["alice", "bob"]);
    expect(await service.resolveBudget(alpha)).toEqual({ dailyRuns: 3, weeklyRuns: 50 });
    expect((await service.resolveIntegrations(alpha)).map((i) => i.id)).toEqual([
      "co-jira",
      "co-slack",
      "mine-sentry",
    ]);
  });

  it("resolve() returns all three facets from a single pass", async () => {
    const acme: Company = { id: "acme", name: "Acme Corp", budget: { dailyRuns: 10 } };
    const service = build({ companies: [acme] });
    const alpha = project({ id: "alpha", companyId: "acme" });
    expect(await service.resolve(alpha)).toEqual({
      people: [],
      budget: { dailyRuns: 10 },
      integrations: [],
    });
  });

  describe("resolveCompanyRef (Phase 72)", () => {
    it("returns undefined for a company-less project", async () => {
      const service = build();
      const alpha = project({ id: "alpha" });
      expect(await service.resolveCompanyRef(alpha)).toBeUndefined();
    });

    it("returns undefined for a dangling companyId (company deleted)", async () => {
      const service = build({ companies: [] });
      const alpha = project({ id: "alpha", companyId: "ghost" });
      expect(await service.resolveCompanyRef(alpha)).toBeUndefined();
    });

    it("returns the linked company's id/name when it resolves", async () => {
      const acme: Company = { id: "acme", name: "Acme Corp" };
      const service = build({ companies: [acme] });
      const alpha = project({ id: "alpha", companyId: "acme" });
      expect(await service.resolveCompanyRef(alpha)).toEqual({ id: "acme", name: "Acme Corp" });
    });
  });

  describe("team resolution chain (Phase 3, team knowledge base)", () => {
    const kb = { kind: "vault", path: "/tmp/kb", readOnly: true } as const;

    it("knowledgeBaseFor returns the linked team's knowledge base", async () => {
      const devrel = team({ id: "devrel", knowledgeBase: kb });
      const alpha = project({ id: "alpha", teamId: "devrel" });
      const service = build({ teams: [devrel], projects: [alpha] });
      await expect(service.knowledgeBaseFor("alpha")).resolves.toEqual(kb);
    });

    it("dangling teamId (team deleted): knowledgeBaseFor resolves to null, does not throw", async () => {
      const alpha = project({ id: "alpha", teamId: "ghost" });
      const service = build({ teams: [], projects: [alpha] }); // no "ghost" team exists
      await expect(service.knowledgeBaseFor("alpha")).resolves.toBeNull();
    });

    it("no teamId: knowledgeBaseFor returns null and existing resolve* stay unchanged", async () => {
      const alpha = project({ id: "alpha", budget: { dailyRuns: 3 } });
      const service = build({ projects: [alpha] });
      await expect(service.knowledgeBaseFor("alpha")).resolves.toBeNull();
      expect(await service.resolveBudget(alpha)).toEqual(alpha.budget);
    });

    it("no companyId on the project but the team has one: the team-inherited company reaches resolveBudget", async () => {
      const acme: Company = {
        id: "acme",
        name: "Acme Corp",
        budget: { dailyRuns: 10, weeklyRuns: 50 },
      };
      const devrel = team({ id: "devrel", companyId: "acme" });
      const alpha = project({ id: "alpha", teamId: "devrel", budget: { dailyRuns: 3 } });
      const service = build({ companies: [acme], teams: [devrel] });
      expect(await service.resolveBudget(alpha)).toEqual({ dailyRuns: 3, weeklyRuns: 50 });
    });

    it("an explicit project companyId stays authoritative over the team's company", async () => {
      const acme: Company = { id: "acme", name: "Acme Corp", budget: { dailyRuns: 10 } };
      const shoptet: Company = { id: "shoptet", name: "Shoptet", budget: { dailyRuns: 99 } };
      const devrel = team({ id: "devrel", companyId: "shoptet" });
      const alpha = project({ id: "alpha", companyId: "acme", teamId: "devrel" });
      const service = build({ companies: [acme, shoptet], teams: [devrel] });
      expect(await service.resolveBudget(alpha)).toEqual({ dailyRuns: 10 });
    });
  });

  describe("jiraProjectKey (accounts-model decision 6)", () => {
    const jira = integration({
      id: "jr",
      kind: "jira",
      config: { kind: "jira", baseUrl: "https://j.example", email: "a@b.c", projectKey: "ACC" },
    });

    it("the project's team board wins over the account's projectKey", async () => {
      const service = build({ teams: [team({ id: "t", board: "TEAM" })] });
      const alpha = project({ id: "alpha", teamId: "t" });
      await expect(service.jiraProjectKey(alpha, jira)).resolves.toBe("TEAM");
    });

    it("no team board: falls back to the account's projectKey, else undefined", async () => {
      const service = build({ teams: [team({ id: "t" })] });
      const alpha = project({ id: "alpha", teamId: "t" });
      await expect(service.jiraProjectKey(alpha, jira)).resolves.toBe("ACC");
      await expect(service.jiraProjectKey(alpha)).resolves.toBeUndefined();
    });
  });

  describe("which projects an account serves", () => {
    const companyJira = integration({
      id: "co-jira",
      kind: "jira",
      companyId: "co",
      config: { kind: "jira", baseUrl: "https://co.atlassian.net", email: "me@co" },
    });

    const personalJira = integration({
      id: "mine-jira",
      kind: "jira",
      config: { kind: "jira", baseUrl: "https://me.atlassian.net", email: "me@me" },
    });

    it("inheritingProjects: the company's projects (direct or via team), never another company's", async () => {
      const service = build({
        companies: [
          { id: "co", name: "Co" },
          { id: "other", name: "Other" },
        ],
        teams: [team({ id: "t", companyId: "co" })],
        integrations: [companyJira, personalJira],
        projects: [
          project({ id: "direct", companyId: "co" }),
          project({ id: "via-team", teamId: "t" }),
          project({ id: "elsewhere", companyId: "other" }),
        ],
      });

      const ids = (await service.inheritingProjects(companyJira)).map((p) => p.id);

      expect(ids).toEqual(["direct", "via-team"]);
    });

    it("inheritingProjects: a personal project-scoped account serves the projects whose company leaves its slot empty", async () => {
      const service = build({
        companies: [
          { id: "co", name: "Co" },
          { id: "other", name: "Other" },
        ],
        integrations: [companyJira, personalJira],
        projects: [
          project({ id: "co-project", companyId: "co" }),
          project({ id: "other-project", companyId: "other" }),
          project({ id: "loose" }),
        ],
      });

      const ids = (await service.inheritingProjects(personalJira)).map((p) => p.id);

      expect(ids).toEqual(["other-project", "loose"]);
    });

    it("inheritingProjects: a personal mailbox serves no project", async () => {
      const mail = integration({ id: "mine-mail", kind: "email" });
      const service = build({
        integrations: [mail],
        projects: [project({ id: "loose" })],
      });

      expect(await service.inheritingProjects(mail)).toEqual([]);
    });

    it("a repo is polled by exactly one account: the company's, not the operator's", async () => {
      const github = (id: string, companyId?: string) =>
        integration({
          id,
          kind: "github",
          ...(companyId ? { companyId } : {}),
          config: { kind: "github", streams: ["pulls"], username: "me" },
        });
      const co = github("co-github", "co");
      const mine = github("mine-github");
      const service = build({
        companies: [{ id: "co", name: "Co" }],
        integrations: [co, mine],
        projects: [
          project({ id: "a", companyId: "co", gitRemote: "git@github.com:co/web.git" }),
          project({ id: "b", gitRemote: "git@github.com:me/side.git" }),
        ],
      });

      expect([...(await service.githubRepoTargets(co))]).toEqual([["co/web", ["a"]]]);
      expect([...(await service.githubRepoTargets(mine))]).toEqual([["me/side", ["b"]]]);
    });

    it("githubRepoTargets: distinct repos of the inheriting projects (phase 129)", async () => {
      const companyGithub = integration({
        id: "co-github",
        kind: "github",
        companyId: "co",
        config: { kind: "github", streams: ["pulls"], username: "me" },
      });
      const service = build({
        companies: [{ id: "co", name: "Co" }],
        integrations: [companyGithub],
        projects: [
          project({ id: "a", companyId: "co", gitRemote: "git@github.com:co/web.git" }),
          project({ id: "b", companyId: "co", gitRemote: "https://github.com/co/web" }),
          project({ id: "c", companyId: "co", gitRemote: "git@github.com:co/api.git" }),
          project({ id: "no-remote", companyId: "co" }),
        ],
      });

      const targets = await service.githubRepoTargets(companyGithub);

      expect([...targets]).toEqual([
        ["co/web", ["a", "b"]],
        ["co/api", ["c"]],
      ]);
    });

    it("gitlabRepoTargets: repos of the inheriting projects on the integration's host", async () => {
      const companyGitlab = integration({
        id: "co-gitlab",
        kind: "gitlab",
        companyId: "co",
        config: { kind: "gitlab", host: "gitlab.example.com", streams: ["pulls"], username: "me" },
      });
      const service = build({
        companies: [{ id: "co", name: "Co" }],
        integrations: [companyGitlab],
        projects: [
          project({
            id: "a",
            companyId: "co",
            gitRemote: "git@gitlab.example.com:grp/sub/web.git",
          }),
          project({
            id: "b",
            companyId: "co",
            gitRemote: "https://gitlab.example.com/grp/sub/web",
          }),
          project({ id: "other-host", companyId: "co", gitRemote: "git@github.com:co/web.git" }),
          project({ id: "no-remote", companyId: "co" }),
          project({
            id: "bad-path",
            companyId: "co",
            gitRemote: "git@gitlab.example.com:g/$(id)/w.git",
          }),
        ],
      });

      expect([...(await service.gitlabRepoTargets(companyGitlab))]).toEqual([
        ["grp/sub/web", ["a", "b"]],
      ]);
    });

    it("gitlab: a personal gitlab.com account and the company's self-hosted one each poll their own repos", async () => {
      const gl = (id: string, host: string, companyId?: string) =>
        integration({
          id,
          kind: "gitlab",
          ...(companyId ? { companyId } : {}),
          config: { kind: "gitlab", host, streams: ["pulls"], username: "me" },
        });
      const co = gl("co-gl", "gitlab.co.example", "co");
      const mine = gl("mine-gl", "gitlab.com");
      const service = build({
        companies: [{ id: "co", name: "Co" }],
        integrations: [co, mine],
        projects: [
          project({ id: "a", companyId: "co", gitRemote: "git@gitlab.co.example:grp/web.git" }),
          project({ id: "b", companyId: "co", gitRemote: "git@gitlab.com:me/lib.git" }),
        ],
      });

      expect([...(await service.gitlabRepoTargets(co))]).toEqual([["grp/web", ["a"]]]);
      expect([...(await service.gitlabRepoTargets(mine))]).toEqual([["me/lib", ["b"]]]);
    });
  });
});
