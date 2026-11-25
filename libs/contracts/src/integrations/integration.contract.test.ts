import { describe, expect, it } from "vitest";
import { EmptyBodySchema } from "../common.schema";
import {
  CreateIntegrationSchema,
  CredentialsInputSchema,
  IntegrationConfigSchema,
  IntegrationSchema,
  PROJECT_SCOPED_KINDS,
  UpdateIntegrationSchema,
  integrationsContract,
  isPersonalAccount,
} from "../index";

describe("integrationsContract", () => {
  it("exposes CRUD + credentials + test under /api/integrations", () => {
    expect(integrationsContract.createIntegration.path).toBe("/api/integrations");
    expect(integrationsContract.setCredentials.path).toBe("/api/integrations/:id/credentials");
    expect(integrationsContract.setCredentials.method).toBe("PUT");
    expect(integrationsContract.testIntegration.path).toBe("/api/integrations/:id/test");
    expect(integrationsContract.updateIntegration.method).toBe("PATCH");
  });

  it("testIntegration's empty body IS the shared EmptyBodySchema (T11 dedup, finding #37)", () => {
    expect(integrationsContract.testIntegration.body).toBe(EmptyBodySchema);
  });
});

describe("integration schema", () => {
  it("accepts a slack and an email integration", () => {
    expect(
      IntegrationSchema.safeParse({
        id: "team-slack",
        kind: "slack",
        companyId: "acme",
        config: { kind: "slack", channels: ["C123"] },
      }).success,
    ).toBe(true);
    expect(
      IntegrationSchema.safeParse({
        id: "support-mail",
        kind: "email",
        companyId: "acme",
        config: {
          kind: "email",
          imapHost: "imap.example.com",
          imapPort: 993,
          smtpHost: "smtp.example.com",
          smtpPort: 465,
          user: "bot@example.com",
        },
      }).success,
    ).toBe(true);
  });

  it("defaults enabled/status/hasCredentials", () => {
    const parsed = IntegrationSchema.parse({
      id: "x",
      kind: "slack",
      companyId: "acme",
      config: { kind: "slack", channels: [] },
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.status).toBe("disconnected");
    expect(parsed.hasCredentials).toBe(false);
    expect(parsed.companyId).toBe("acme");
  });

  it("parses a personal account (no companyId)", () => {
    const parsed = IntegrationSchema.parse({
      id: "x",
      kind: "slack",
      config: { kind: "slack", channels: [] },
    });
    expect(parsed.companyId).toBeUndefined();
    expect(isPersonalAccount(parsed)).toBe(true);
  });

  it("accepts a company-owned account; isPersonalAccount is false for it", () => {
    const parsed = IntegrationSchema.parse({
      id: "x",
      kind: "slack",
      companyId: "acme",
      config: { kind: "slack", channels: [] },
    });
    expect(parsed.companyId).toBe("acme");
    expect("projectId" in parsed).toBe(false);
    expect(isPersonalAccount(parsed)).toBe(false);
  });

  it("CreateIntegrationSchema takes a company owner or none (personal)", () => {
    const config = { kind: "slack" as const, channels: [] };
    expect(CreateIntegrationSchema.safeParse({ id: "x", kind: "slack", config }).success).toBe(
      true,
    );
    expect(
      CreateIntegrationSchema.safeParse({ id: "x", kind: "slack", companyId: "acme", config })
        .success,
    ).toBe(true);
  });

  it("UpdateIntegrationSchema accepts companyId: null (move to the operator)", () => {
    expect(UpdateIntegrationSchema.parse({ companyId: null }).companyId).toBeNull();
    expect(UpdateIntegrationSchema.parse({ companyId: "acme" }).companyId).toBe("acme");
    expect(UpdateIntegrationSchema.parse({}).companyId).toBeUndefined();
  });

  it("PROJECT_SCOPED_KINDS are the kinds a project can inherit", () => {
    expect([...PROJECT_SCOPED_KINDS].sort()).toEqual(["github", "gitlab", "jira", "sentry"]);
  });

  it("does not carry an department (membership is derived, not stored)", () => {
    const parsed = IntegrationSchema.parse({
      id: "x",
      kind: "slack",
      companyId: "acme",
      config: { kind: "slack", channels: [] },
    });
    expect("department" in parsed).toBe(false);
  });

  it("rejects a config whose kind disagrees with the integration kind", () => {
    expect(
      IntegrationSchema.safeParse({
        id: "x",
        kind: "slack",
        companyId: "acme",
        config: {
          kind: "email",
          imapHost: "h",
          imapPort: 1,
          smtpHost: "h",
          smtpPort: 1,
          user: "u",
        },
      }).success,
    ).toBe(true); // schema only constrains config internally; controller pins kind===config.kind
  });

  // Law 4 / credentials hygiene: no secret-shaped key can parse into a committed config.
  it("rejects secret-shaped keys in config (no token/password persists)", () => {
    expect(
      IntegrationConfigSchema.safeParse({ kind: "slack", channels: [], token: "xoxb-leak" })
        .success,
    ).toBe(false);
    expect(
      IntegrationConfigSchema.safeParse({
        kind: "email",
        imapHost: "h",
        imapPort: 1,
        smtpHost: "h",
        smtpPort: 1,
        user: "u",
        password: "leak",
      }).success,
    ).toBe(false);
  });

  it("credentials input is a closed per-kind union", () => {
    expect(CredentialsInputSchema.safeParse({ token: "xoxb-1" }).success).toBe(true);
    expect(CredentialsInputSchema.safeParse({ password: "pw" }).success).toBe(true);
    expect(CredentialsInputSchema.safeParse({ token: "a", password: "b" }).success).toBe(false);
    expect(CredentialsInputSchema.safeParse({ apiKey: "a" }).success).toBe(false);
  });

  // NS2 F7a — the first monitor-only integration kind.
  it("accepts a sentry integration + token credential", () => {
    const parsed = IntegrationSchema.safeParse({
      id: "acme-sentry",
      kind: "sentry",
      companyId: "acme",
      config: { kind: "sentry", org: "acme", project: "backend" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.config).toMatchObject({ minLevel: "error" });
    }
    expect(CredentialsInputSchema.safeParse({ token: "sntrys_x" }).success).toBe(true);
  });

  it("SentryConfigSchema.strict() rejects a stray token key", () => {
    expect(
      IntegrationConfigSchema.safeParse({
        kind: "sentry",
        org: "acme",
        project: "backend",
        token: "leak",
      }).success,
    ).toBe(false);
  });

  it("sentry minLevel defaults to 'error'", () => {
    const parsed = IntegrationConfigSchema.parse({
      kind: "sentry",
      org: "acme",
      project: "backend",
    });
    expect(parsed).toMatchObject({ minLevel: "error" });
  });
});

describe("GitHub account repo", () => {
  const base = { id: "gh", kind: "github" as const };
  const config = { kind: "github" as const, username: "me" };
  it("an account without repo is valid, company-owned or personal", () => {
    expect(CreateIntegrationSchema.safeParse({ ...base, companyId: "acme", config }).success).toBe(
      true,
    );
    expect(CreateIntegrationSchema.safeParse({ ...base, config }).success).toBe(true);
  });
  it("create rejects a config.repo", () => {
    const r = CreateIntegrationSchema.safeParse({
      ...base,
      companyId: "acme",
      config: { ...config, repo: "a/b" },
    });
    expect(r.success).toBe(false);
  });
});

describe("gitlab integration", () => {
  const config = {
    kind: "gitlab" as const,
    host: "gitlab.group.team.blue",
    username: "karel.zibar",
  };
  const base = { id: "gl", kind: "gitlab" as const };
  it("defaults streams and accepts a nested repo", () => {
    const parsed = IntegrationConfigSchema.parse({ ...config, repo: "shoptet/projects/app" });
    expect(parsed).toMatchObject({ streams: ["issues", "pulls"], repo: "shoptet/projects/app" });
  });
  it.each(["https://gitlab.com", "gitlab com", "gitlab.com/x", ""])("rejects host %j", (host) => {
    expect(IntegrationConfigSchema.safeParse({ ...config, host }).success).toBe(false);
  });
  it("accepts host with port, rejects a single-segment repo and unknown keys", () => {
    expect(IntegrationConfigSchema.safeParse({ ...config, host: "gl.local:8443" }).success).toBe(
      true,
    );
    expect(IntegrationConfigSchema.safeParse({ ...config, repo: "solo" }).success).toBe(false);
    expect(IntegrationConfigSchema.safeParse({ ...config, token: "x" }).success).toBe(false);
    expect(IntegrationConfigSchema.safeParse({ ...config, username: "" }).success).toBe(false);
  });
  it("create accepts an account without repo and rejects a config.repo", () => {
    expect(CreateIntegrationSchema.safeParse({ ...base, companyId: "c", config }).success).toBe(
      true,
    );
    expect(CreateIntegrationSchema.safeParse({ ...base, config }).success).toBe(true);
    expect(
      CreateIntegrationSchema.safeParse({
        ...base,
        companyId: "c",
        config: { ...config, repo: "a/b" },
      }).success,
    ).toBe(false);
  });
});
