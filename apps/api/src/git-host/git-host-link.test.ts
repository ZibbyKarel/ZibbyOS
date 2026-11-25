import type { Integration, Project } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import type { CredentialsStore } from "../integrations/credentials.store";
import type { ResolvedProjectService } from "../projects/resolved-project.service";
import { resolveGitHostLink } from "./git-host-link";

const project = { id: "p", gitRemote: "git@gitlab.example.com:g/sub/app.git" } as Project;
const githubProject = { id: "p", gitRemote: "git@github.com:acme/web.git" } as Project;

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
  companyId: "c",
  enabled: true,
  status: "connected",
  hasCredentials: true,
  config: { kind: "github", streams: [], username: "me" },
} as Integration;

const link = (integrations: Integration[], token: string | null = "tok", on: Project = project) =>
  resolveGitHostLink(
    { resolveIntegrations: async () => integrations } as unknown as ResolvedProjectService,
    { read: async () => (token ? { token } : null) } as unknown as CredentialsStore,
    on,
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
    const result = await link([gitlab, github], "tok", githubProject);
    expect(result).toEqual({ kind: "github", repo: "acme/web", token: "tok", username: "me" });
  });

  it("github only", async () => {
    await expect(link([github], "tok", githubProject)).resolves.toMatchObject({
      kind: "github",
      repo: "acme/web",
    });
  });

  it("none", async () => {
    await expect(link([])).resolves.toBeNull();
    await expect(link([github], null)).resolves.toBeNull();
  });

  it("yields no gitlab link for a repo or host of an unexpected shape", async () => {
    for (const repo of ["g/my app", "g/a`b", "g/a\nb", "g/<x>"]) {
      const odd = { id: "p", gitRemote: `https://gitlab.example.com/${repo}.git` } as Project;
      await expect(link([gitlab], null, odd)).resolves.toBeNull();
    }
    const badHost = { ...gitlab, config: { ...gitlab.config, host: "x y" } } as Integration;
    await expect(link([badHost], null)).resolves.toBeNull();
    const nested = {
      id: "p",
      gitRemote: "git@gitlab.example.com:group/sub/project.git",
    } as Project;
    await expect(link([gitlab], null, nested)).resolves.toMatchObject({
      repo: "group/sub/project",
    });
  });
});
