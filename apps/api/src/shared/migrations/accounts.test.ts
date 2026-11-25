import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACCOUNTS_MIGRATION_BACKUP, ACCOUNTS_MIGRATION_MARKER, migrateAccounts } from "./accounts";

let root: string;

const write = async (rel: string, value: unknown): Promise<void> => {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, typeof value === "string" ? value : JSON.stringify(value), "utf8");
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw migrated JSON, asserted field by field
const read = async (rel: string): Promise<any> =>
  JSON.parse(await fs.readFile(path.join(root, rel), "utf8"));
const has = (rel: string): Promise<boolean> =>
  fs.access(path.join(root, rel)).then(
    () => true,
    () => false,
  );

const gitlab = (id: string, projectId: string, repo: string) => ({
  id,
  kind: "gitlab",
  projectId,
  config: { kind: "gitlab", host: "gitlab.example.com", repo, streams: ["pulls"], username: "me" },
});

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "accounts-migration-"));
  await write("projects/_projects.json", [
    {
      id: "cli",
      companyId: "acme",
      teamId: "devrel",
      gitRemote: "git@gitlab.example.com:Acme/cli.git",
      integrationRouting: [
        { integrationId: "acme-jira", match: { kind: "jira", projectKey: "ABC", jql: "x" } },
      ],
    },
    { id: "solo" },
    { id: "self", companyId: "acme" },
    { id: "via-team", teamId: "devrel" },
  ]);
  await write("teams/_teams.json", [
    { id: "devrel", name: "DevRel", companyId: "acme" },
    { id: "keyed", name: "Keyed", jiraProjectKey: "OLD" },
  ]);
  await write("integrations/cli-gitlab.json", gitlab("cli-gitlab", "cli", "acme/cli"));
  await write("integrations/solo-gitlab.json", gitlab("solo-gitlab", "solo", "me/solo"));
  await write("integrations/team-gitlab.json", gitlab("team-gitlab", "via-team", "acme/x"));
  await write("integrations/mail.json", {
    id: "mail",
    kind: "email",
    projectId: "self",
    config: { kind: "email" },
  });
  await write("integrations/acme-jira.json", {
    id: "acme-jira",
    kind: "jira",
    companyId: "acme",
    config: { kind: "jira" },
  });
  await write("channels/cli-gitlab/cursor.json", { cursor: "2026-01-01" });
  await write("monitors/cursors/cli-gitlab--gitlab-ci.cursor", "2026-01-02");
  await write("monitors/status/cli-gitlab--gitlab-ci.json", { state: "green" });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("migrateAccounts", () => {
  it("re-owns project integrations: company, operator for no company, operator for mail", async () => {
    const result = await migrateAccounts(root);
    expect(result).toEqual({ skipped: false, accounts: 4, teams: 2 });

    const cli = await read("integrations/cli-gitlab.json");
    expect(cli).toMatchObject({ id: "cli-gitlab", companyId: "acme" });
    expect(cli.projectId).toBeUndefined();
    expect(cli.config.repo).toBeUndefined();

    const solo = await read("integrations/solo-gitlab.json");
    expect(solo.companyId).toBeUndefined();
    expect(solo.projectId).toBeUndefined();

    expect((await read("integrations/team-gitlab.json")).companyId).toBe("acme");

    const mail = await read("integrations/mail.json");
    expect(mail.companyId).toBeUndefined();
    expect(mail.projectId).toBeUndefined();

    // untouched: already company-owned, no repo
    expect(await read("integrations/acme-jira.json")).toEqual({
      id: "acme-jira",
      kind: "jira",
      companyId: "acme",
      config: { kind: "jira" },
    });
  });

  it("gives a remote-less project its gitRemote and keeps an existing one", async () => {
    await migrateAccounts(root);
    const projects = await read("projects/_projects.json");
    const byId = (id: string) => projects.find((p: { id: string }) => p.id === id);
    expect(byId("solo").gitRemote).toBe("git@gitlab.example.com:me/solo.git");
    expect(byId("cli").gitRemote).toBe("git@gitlab.example.com:Acme/cli.git");
  });

  it("moves poll cursors to the per-repo slot (keyed like the watcher: the remote's path)", async () => {
    await migrateAccounts(root);
    expect(await read("channels/cli-gitlab/cursor.json")).toEqual({
      cursor: "2026-01-01",
      repos: { "Acme/cli": "2026-01-01" },
    });
    expect(await has("monitors/cursors/cli-gitlab--gitlab-ci.cursor")).toBe(false);
    expect(await has("monitors/cursors/cli-gitlab--Acme-cli--gitlab-ci.cursor")).toBe(true);
    expect(await has("monitors/status/cli-gitlab--Acme-cli--gitlab-ci.json")).toBe(true);
  });

  it("renames a team's jiraProjectKey to board and seeds one from routing rules", async () => {
    await migrateAccounts(root);
    const teams = await read("teams/_teams.json");
    expect(teams[0]).toMatchObject({ id: "devrel", board: "ABC" });
    expect(teams[1]).toEqual({ id: "keyed", name: "Keyed", board: "OLD" });
  });

  it("backs up first, writes the marker, and is a no-op on re-run", async () => {
    await migrateAccounts(root);
    expect(await has(ACCOUNTS_MIGRATION_MARKER)).toBe(true);
    const backedUp = await read(`${ACCOUNTS_MIGRATION_BACKUP}/integrations/cli-gitlab.json`);
    expect(backedUp.projectId).toBe("cli");
    expect((await read(`${ACCOUNTS_MIGRATION_BACKUP}/_teams.json`))[1].jiraProjectKey).toBe("OLD");

    const before = await read("integrations/cli-gitlab.json");
    expect(await migrateAccounts(root)).toEqual({ skipped: true, accounts: 0, teams: 0 });
    expect(await read("integrations/cli-gitlab.json")).toEqual(before);
  });

  it("skips a missing data root", async () => {
    expect((await migrateAccounts(path.join(root, "nope"))).skipped).toBe(true);
  });
});
