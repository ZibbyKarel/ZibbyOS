import type { Integration, ProjectBudget, ProjectPerson } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import {
  accountSlot,
  computeResolvedContext,
  mergeBudget,
  mergePeople,
  resolveAccounts,
  resolveEffectiveCompanyId,
  resolveKnowledgeBase,
  samePerson,
} from "./resolved-project.helpers";

const person = (over: Partial<ProjectPerson> & { name: string }): ProjectPerson => ({
  role: "Stakeholder",
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

describe("samePerson", () => {
  it("matches by id when both sides have one, even with different names", () => {
    expect(
      samePerson(person({ id: "p1", name: "Alice" }), person({ id: "p1", name: "Alicia" })),
    ).toBe(true);
  });

  it("does not match different ids even with the same name", () => {
    expect(
      samePerson(person({ id: "p1", name: "Alice" }), person({ id: "p2", name: "Alice" })),
    ).toBe(false);
  });

  it("falls back to case-insensitive name match when either side lacks an id", () => {
    expect(samePerson(person({ id: "p1", name: "Alice" }), person({ name: "ALICE" }))).toBe(true);
    expect(samePerson(person({ name: "alice" }), person({ name: "Alice" }))).toBe(true);
  });

  it("name fallback does not match a different name", () => {
    expect(samePerson(person({ name: "Alice" }), person({ name: "Bob" }))).toBe(false);
  });
});

describe("mergePeople", () => {
  it("a project person with a matching id overrides the company person (field-level)", () => {
    const company = [person({ id: "alice", name: "Alice", role: "CEO", vip: true })];
    const project = [person({ id: "alice", name: "Alice", role: "Primary contact" })];
    const result = mergePeople(company, project);
    // role overridden by the project; vip (unset by the project) inherited from company.
    expect(result).toEqual([{ id: "alice", name: "Alice", role: "Primary contact", vip: true }]);
  });

  it("a project person with a new id is added alongside the company roster", () => {
    const company = [person({ id: "alice", name: "Alice", role: "CEO" })];
    const project = [person({ id: "bob", name: "Bob", role: "Engineer" })];
    const result = mergePeople(company, project);
    expect(result.map((p) => p.id)).toEqual(["alice", "bob"]);
  });

  it("company-only people (no project override) are included unchanged", () => {
    const company = [person({ id: "alice", name: "Alice", role: "CEO" })];
    const result = mergePeople(company, []);
    expect(result).toEqual(company);
  });

  it("matches by name when a side lacks an id (mid-backfill), field-merging the override", () => {
    const company = [person({ name: "Jan Novák", role: "Client", vip: true })]; // no id yet
    const project = [person({ id: "jan-novak", name: "Jan Novák", role: "Primary" })];
    const result = mergePeople(company, project);
    expect(result).toEqual([{ id: "jan-novak", name: "Jan Novák", role: "Primary", vip: true }]);
  });

  it("does not mutate its inputs", () => {
    const company = [person({ id: "alice", name: "Alice", role: "CEO" })];
    const project = [person({ id: "alice", name: "Alice", role: "Primary" })];
    mergePeople(company, project);
    expect(company[0]?.role).toBe("CEO");
  });
});

describe("mergeBudget", () => {
  const companyBudget: ProjectBudget = { dailyRuns: 10, weeklyRuns: 50 };

  it("field-level merge: project fields win, unset fields inherit the company default", () => {
    const projectBudget: ProjectBudget = { dailyRuns: 3 };
    expect(mergeBudget(companyBudget, projectBudget)).toEqual({
      dailyRuns: 3,
      weeklyRuns: 50,
    });
  });

  it("is not all-or-nothing: a project setting only one field still inherits the rest", () => {
    const projectBudget: ProjectBudget = { monthlyCostCapUsd: 100 };
    expect(mergeBudget(companyBudget, projectBudget)).toEqual({
      dailyRuns: 10,
      weeklyRuns: 50,
      monthlyCostCapUsd: 100,
    });
  });

  it("no company budget: the project's own budget passes through unchanged", () => {
    const projectBudget: ProjectBudget = { dailyRuns: 3 };
    expect(mergeBudget(undefined, projectBudget)).toEqual(projectBudget);
  });

  it("no project budget: the company default passes through unchanged", () => {
    expect(mergeBudget(companyBudget, undefined)).toEqual(companyBudget);
  });

  it("neither set: undefined (no budget at all)", () => {
    expect(mergeBudget(undefined, undefined)).toBeUndefined();
  });
});

const gitlab = (id: string, host: string, companyId?: string): Integration =>
  integration({
    id,
    kind: "gitlab",
    ...(companyId ? { companyId } : {}),
    config: { kind: "gitlab", host, streams: ["issues", "pulls"], username: "me" },
  });

describe("accountSlot", () => {
  it("is the kind, except gitlab, whose slot is per (lowercased) host", () => {
    expect(accountSlot(integration({ id: "s", kind: "slack" }))).toBe("slack");
    expect(accountSlot(gitlab("g", "GitLab.Example.com"))).toBe("gitlab:gitlab.example.com");
  });
});

describe("resolveAccounts", () => {
  it("the company's accounts come first; a personal account of the same slot is not inherited", () => {
    const all = [
      integration({ id: "mine-jira", kind: "jira" }),
      integration({ id: "co-jira", kind: "jira", companyId: "co" }),
    ];
    expect(resolveAccounts(all, "co").map((i) => i.id)).toEqual(["co-jira"]);
  });

  it("personal accounts fill the project-scoped slots the company leaves empty", () => {
    const all = [
      integration({ id: "co-slack", kind: "slack", companyId: "co" }),
      integration({ id: "mine-github", kind: "github" }),
      integration({ id: "mine-sentry", kind: "sentry" }),
    ];
    expect(resolveAccounts(all, "co").map((i) => i.id)).toEqual([
      "co-slack",
      "mine-github",
      "mine-sentry",
    ]);
  });

  it("never inherits a personal mailbox, calendar or Slack", () => {
    const all = [
      integration({ id: "mine-mail", kind: "email" }),
      integration({ id: "mine-cal", kind: "calendar" }),
      integration({ id: "mine-slack", kind: "slack" }),
      integration({ id: "mine-jira", kind: "jira" }),
    ];
    expect(resolveAccounts(all, undefined).map((i) => i.id)).toEqual(["mine-jira"]);
  });

  it("another company's accounts never serve the project", () => {
    const all = [integration({ id: "other-jira", kind: "jira", companyId: "other" })];
    expect(resolveAccounts(all, "co")).toEqual([]);
    expect(resolveAccounts(all, undefined)).toEqual([]);
  });

  it("gitlab: one slot per host — the company's host and a personal one both serve", () => {
    const all = [
      gitlab("co-gl", "gitlab.co.example", "co"),
      gitlab("mine-gl", "gitlab.com"),
      gitlab("mine-gl-co", "GITLAB.co.example"),
    ];
    expect(resolveAccounts(all, "co").map((i) => i.id)).toEqual(["co-gl", "mine-gl"]);
  });

  it("first by id wins within a group, whatever the listing order", () => {
    const all = [
      integration({ id: "co-jira-b", kind: "jira", companyId: "co" }),
      integration({ id: "co-jira-a", kind: "jira", companyId: "co" }),
      integration({ id: "mine-gh-b", kind: "github" }),
      integration({ id: "mine-gh-a", kind: "github" }),
    ];
    expect(resolveAccounts(all, "co").map((i) => i.id)).toEqual(["co-jira-a", "mine-gh-a"]);
  });
});

describe("computeResolvedContext", () => {
  const project = {
    id: "alpha",
    name: "Alpha",
    path: "/work/alpha",
    identity: { people: [person({ id: "bob", name: "Bob", role: "Engineer" })] },
    budget: { dailyRuns: 3 } as ProjectBudget,
  };
  const accounts = [
    integration({ id: "co-jira", kind: "jira", companyId: "co" }),
    integration({ id: "mine-github", kind: "github" }),
    integration({ id: "mine-mail", kind: "email" }),
  ];

  it("company null (no companyId / dangling): own people/budget, only personal project-scoped accounts", () => {
    const result = computeResolvedContext(project, null, accounts);
    expect(result.people).toEqual(project.identity.people);
    expect(result.budget).toEqual(project.budget);
    expect(result.integrations.map((i) => i.id)).toEqual(["mine-github"]);
  });

  it("with a company: merges all three facets", () => {
    const company = {
      id: "co",
      people: [person({ id: "alice", name: "Alice", role: "CEO", vip: true })],
      budget: { dailyRuns: 10, weeklyRuns: 50 } as ProjectBudget,
    };
    const result = computeResolvedContext(project, company, accounts);
    expect(result.people.map((p) => p.id).sort()).toEqual(["alice", "bob"]);
    expect(result.budget).toEqual({ dailyRuns: 3, weeklyRuns: 50 });
    expect(result.integrations.map((i) => i.id)).toEqual(["co-jira", "mine-github"]);
  });
});

const kb = { kind: "vault", path: "/tmp/kb", readOnly: true } as const;

describe("resolveKnowledgeBase", () => {
  it("returns null when the project has no team", () => {
    expect(resolveKnowledgeBase({ id: "p", name: "P" }, null)).toBeNull();
  });

  it("returns null when the team has no knowledge base", () => {
    expect(
      resolveKnowledgeBase({ id: "p", name: "P" }, { id: "devrel", name: "DevRel" }),
    ).toBeNull();
  });

  it("returns the team's knowledge base", () => {
    expect(
      resolveKnowledgeBase(
        { id: "p", name: "P" },
        { id: "devrel", name: "DevRel", knowledgeBase: kb },
      ),
    ).toEqual(kb);
  });
});

describe("resolveEffectiveCompanyId", () => {
  it("prefers an explicit project link over the team's company", () => {
    expect(
      resolveEffectiveCompanyId(
        { id: "p", name: "P", companyId: "acme" },
        {
          id: "devrel",
          name: "DevRel",
          companyId: "shoptet",
        },
      ),
    ).toBe("acme");
  });

  it("falls back to the team's company", () => {
    expect(
      resolveEffectiveCompanyId(
        { id: "p", name: "P" },
        {
          id: "devrel",
          name: "DevRel",
          companyId: "shoptet",
        },
      ),
    ).toBe("shoptet");
  });

  it("returns undefined when neither has one", () => {
    expect(resolveEffectiveCompanyId({ id: "p", name: "P" }, null)).toBeUndefined();
  });
});
