import { describe, expect, it } from "vitest";
import type { Integration } from "@zibby/contracts";
import { buildConnections, inheritingProjects, projectMarks } from "./connectionsModel";

const NOW = Date.parse("2026-11-19T00:00:00Z");
const base = { enabled: true, hasCredentials: true, status: "connected" } as const;
const jiraCfg = { kind: "jira", baseUrl: "https://a.atlassian.net", email: "a@a.cz" } as never;
const mk = (o: Partial<Integration> & { id: string; kind: Integration["kind"] }): Integration =>
  ({ ...base, config: jiraCfg, ...o }) as Integration;

const integrations = [
  mk({ id: "co-jira", kind: "jira", companyId: "acme" }),
  mk({ id: "co-slack", kind: "slack", companyId: "acme", status: "error" }),
  mk({
    id: "co-mail",
    kind: "email",
    companyId: "acme",
    tokenExpiresAt: "2026-11-24T00:00:00Z",
  }),
  mk({ id: "pr-jira", kind: "jira", projectId: "api" }),
];
const projects = [
  { id: "api", name: "api", companyId: "acme" },
  { id: "web", name: "web", companyId: "acme" },
];

describe("buildConnections", () => {
  it("company page: own tiles serve every company project, errors lead attention", () => {
    const m = buildConnections(integrations, projects, { companyId: "acme" }, NOW);
    expect(m.own).toHaveLength(3);
    expect(m.own[0]?.serves).toBe(2);
    expect(m.attention.map((t) => t.integration.id)).toEqual(["co-slack", "co-mail"]);
    expect(m.down.map((t) => t.integration.id)).toEqual(["co-slack"]);
    expect(m.attention[1]?.expiresInDays).toBe(5);
    expect(m.connected).toBe(2);
  });

  it("project page: an own integration of a kind overrides the company's one", () => {
    const m = buildConnections(
      integrations,
      projects,
      { projectId: "api", parentCompanyId: "acme" },
      NOW,
    );
    expect(m.own.map((t) => t.integration.id)).toEqual(["pr-jira"]);
    expect(m.inherited.map((t) => t.integration.id)).toEqual(["co-slack", "co-mail"]);
  });

  it("team page: all inherited from the company", () => {
    const m = buildConnections(
      integrations,
      projects,
      { teamPage: true, parentCompanyId: "acme" },
      NOW,
    );
    expect(m.own).toHaveLength(0);
    expect(m.inherited).toHaveLength(3);
  });
});

describe("inheritingProjects", () => {
  it("excludes projects that override the kind", () => {
    const jira = integrations[0] as Integration;
    expect(inheritingProjects(jira, integrations, projects).map((p) => p.id)).toEqual(["web"]);
  });
});

describe("projectMarks", () => {
  it("lists own kinds first and skips overridden company kinds", () => {
    const mk = (id: string, kind: string, o: object) => ({ id, kind, ...o }) as never;
    const list = [
      mk("1", "github", { projectId: "p" }),
      mk("2", "github", { companyId: "c" }),
      mk("3", "jira", { companyId: "c" }),
    ];
    expect(projectMarks("p", "c", list)).toEqual([
      { kind: "github", own: true },
      { kind: "jira", own: false },
    ]);
  });
});
