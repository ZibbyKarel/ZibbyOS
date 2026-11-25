import { describe, expect, it } from "vitest";
import type { Integration } from "@zibby/contracts";
import { buildConnections, projectMarks } from "./connectionsModel";
import { accountHref } from "./accountHref";

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
  mk({ id: "my-github", kind: "github" }),
];

describe("buildConnections", () => {
  it("tiles carry the origin and serves count; errors lead attention", () => {
    const m = buildConnections(integrations.slice(0, 3), "own", NOW, 2);
    expect(m.tiles).toHaveLength(3);
    expect(m.tiles[0]).toMatchObject({ origin: "own", serves: 2 });
    expect(m.attention.map((t) => t.integration.id)).toEqual(["co-slack", "co-mail"]);
    expect(m.down.map((t) => t.integration.id)).toEqual(["co-slack"]);
    expect(m.attention[1]?.expiresInDays).toBe(5);
    expect(m.connected).toBe(2);
  });
});

describe("projectMarks", () => {
  it("lists the company's account kinds once each", () => {
    expect(
      projectMarks("acme", [...integrations, mk({ id: "x", kind: "jira", companyId: "acme" })]),
    ).toEqual(["jira", "slack", "email"]);
    expect(projectMarks(undefined, integrations)).toEqual([]);
  });
});

describe("accountHref", () => {
  it("routes a company account under the company and a personal one under settings", () => {
    expect(accountHref({ id: "co-jira", companyId: "acme" })).toBe(
      "/companies/acme/integrations/co-jira",
    );
    expect(accountHref({ id: "my-github" })).toBe("/system/settings/accounts/my-github");
  });
});
