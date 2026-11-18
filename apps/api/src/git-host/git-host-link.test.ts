import type { Integration, Project } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import type { CredentialsStore } from "../integrations/credentials.store";
import type { ResolvedProjectService } from "../projects/resolved-project.service";
import { resolveGitHostLink } from "./git-host-link";

const project = { id: "p", gitRemote: "git@gitlab.example.com:g/sub/app.git" } as Project;

const gitlab = {
  id: "gl",
  kind: "gitlab",
  companyId: "c",
  enabled: true,
  status: "connected",
  hasCredentials: false,
  config: { kind: "gitlab", host: "gitlab.example.com", streams: [], username: "karel.zibar" },
} as Integration;
const github = {
  id: "gh",
  kind: "github",
  projectId: "p",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "github", repo: "acme/web", streams: [], username: "me" },
} as Integration;

const link = (integrations: Integration[], token: string | null = "tok") =>
  resolveGitHostLink(
    { resolveIntegrations: async () => integrations } as unknown as ResolvedProjectService,
    { read: async () => (token ? { token } : null) } as unknown as CredentialsStore,
    project,
  );

describe("resolveGitHostLink", () => {
  it("a gitlab integration wins, repo derived from the remote host", async () => {
    await expect(link([github, gitlab])).resolves.toEqual({
      kind: "gitlab",
      host: "gitlab.example.com",
      repo: "g/sub/app",
      username: "karel.zibar",
    });
  });

  it("falls back to github (tagged) when gitlab cannot resolve a repo", async () => {
    const otherHost = { ...project, gitRemote: "git@elsewhere.io:g/app.git" } as Project;
    const result = await resolveGitHostLink(
      { resolveIntegrations: async () => [gitlab, github] } as unknown as ResolvedProjectService,
      { read: async () => ({ token: "tok" }) } as unknown as CredentialsStore,
      otherHost,
    );
    expect(result).toEqual({ kind: "github", repo: "acme/web", token: "tok", username: "me" });
  });

  it("github only", async () => {
    await expect(link([github])).resolves.toMatchObject({ kind: "github", repo: "acme/web" });
  });

  it("none", async () => {
    await expect(link([])).resolves.toBeNull();
    await expect(link([github], null)).resolves.toBeNull();
  });

  it("yields no gitlab link for a repo or host of an unexpected shape", async () => {
    for (const repo of ["g/my app", "g/a`b", "g/a\nb", "g/<x>"]) {
      const odd = { ...gitlab, config: { ...gitlab.config, repo } } as Integration;
      await expect(link([odd], null)).resolves.toBeNull();
    }
    const badHost = { ...gitlab, config: { ...gitlab.config, host: "x y" } } as Integration;
    await expect(link([badHost], null)).resolves.toBeNull();
    const nested = { ...gitlab, config: { ...gitlab.config, repo: "group/sub/project" } };
    await expect(link([nested as Integration])).resolves.toMatchObject({
      repo: "group/sub/project",
    });
  });
});
