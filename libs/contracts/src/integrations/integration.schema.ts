import { z } from "zod";
import { IsoDateTimeSchema } from "../common.schema";
import { AGENT_ID_REGEX } from "../agents/agent.schema";

/**
 * Allowed shape of an integration `id` — the same restrictive pattern agents use
 * (the id doubles as the on-disk file name and as a path segment for that
 * integration's channel items, so no separators / traversal). Defense in depth:
 * the storage layer re-validates independently.
 */
export const IntegrationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(AGENT_ID_REGEX, "id may only contain letters, numbers, '.', '_' and '-'");

/** Which inbound channel an integration speaks. `kind` is immutable after create. */
export const IntegrationKindSchema = z.enum([
  "slack",
  "email",
  "jira",
  "github",
  "gitlab",
  "calendar",
  "sentry",
]);
export type IntegrationKind = z.infer<typeof IntegrationKindSchema>;

/**
 * Slack config — optional allowlist of conversation ids that narrows the @-mention
 * leg only (empty/absent = mentions everywhere); DMs are never narrowed. Non-secret by
 * construction: the user token (`xoxp-…`) lives in the separate credentials store,
 * never here. `.strict()`
 * so a token/password-shaped key can never sneak into the committed entity file.
 */
export const SlackConfigSchema = z
  .object({
    kind: z.literal("slack"),
    channels: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type SlackConfig = z.infer<typeof SlackConfigSchema>;

/**
 * Email (IMAP/SMTP) config. The login `user` is non-secret (an address); the
 * password lives in the credentials store. `.strict()` — same containment.
 */
export const EmailConfigSchema = z
  .object({
    kind: z.literal("email"),
    imapHost: z.string().min(1),
    imapPort: z.number().int().positive(),
    smtpHost: z.string().min(1),
    smtpPort: z.number().int().positive(),
    user: z.string().min(1),
    mailbox: z.string().min(1).optional(),
  })
  .strict();
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

/**
 * Jira config — the site `baseUrl` and the account `email` (both non-secret); the
 * API token lives in the credentials store (Basic `email:token`). `jql` narrows the
 * polled issues (defaults to the project's recently-updated issues). `.strict()`.
 */
export const JiraConfigSchema = z
  .object({
    kind: z.literal("jira"),
    baseUrl: z.string().url(),
    email: z.string().min(1),
    projectKey: z.string().min(1).optional(),
    jql: z.string().min(1).optional(),
  })
  .strict();
export type JiraConfig = z.infer<typeof JiraConfigSchema>;

/**
 * GitHub config. An account never stores a repo: which repos it covers follows from
 * the `gitRemote` of the projects it serves (`githubRepoFor`). `repo` exists only as the
 * watcher's per-poll scope (filled in at runtime, one poll per covered repo) and is
 * rejected on create/update. `streams` selects which event streams to ingest: `issues`
 * and/or `pulls` (the conversational channel), plus `ci` — which opts the account's repos
 * into the N3 CI monitor (workflow-run status alerts, not messages; the channel
 * adapter ignores it). Defaults to the conversational pair. `username` (required,
 * the operator's GitHub handle) scopes polling and roadmap sync to items that
 * mention or are assigned to that user via the Search API. `includeTeams` (opt-in)
 * also ingests items that `@org/team`-mention one of the operator's teams in the
 * repo's org (review requests are the Pull Requests widget's, not a channel's) (needs `read:org` on the
 * token; without it polling stays personal-only). `.strict()`.
 */
export const GitHubConfigSchema = z
  .object({
    kind: z.literal("github"),
    repo: z
      .string()
      .regex(/^[^/]+\/[^/]+$/, "repo must be 'owner/name'")
      .optional(),
    streams: z.array(z.enum(["issues", "pulls", "ci"])).default(["issues", "pulls"]),
    username: z.string().min(1),
    includeTeams: z.boolean().optional(),
  })
  .strict();
export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

/** A GitLab hostname (optionally `:port`). */
export const GITLAB_HOST_SHAPE = /^[a-z0-9.-]+(:\d+)?$/i;
/** A GitLab project's full path, any nesting depth (`group/sub/name`). */
export const GITLAB_REPO_SHAPE = /^[\w.-]+(\/[\w.-]+)+$/;

/**
 * Whether `host` + `repo` are safe to build a GitLab link/target from — the path ends up in
 * prompts, `-R` arguments and URLs, and files on disk can be edited past the schema.
 */
export function isGitlabShape(
  host: string | undefined,
  repo: string | null | undefined,
): repo is string {
  return !!host && !!repo && GITLAB_HOST_SHAPE.test(host) && GITLAB_REPO_SHAPE.test(repo);
}

/**
 * GitLab config (via the `glab` CLI, which holds the auth — no token here). `host` is
 * the hostname only. As with GitHub, `repo` (the full project path, any nesting depth) is
 * runtime-only poll scope: the covered repos are the served projects' `gitRemote`s on `host`.
 * `.strict()`.
 */
export const GitLabConfigSchema = z
  .object({
    kind: z.literal("gitlab"),
    host: z.string().regex(GITLAB_HOST_SHAPE, "host must be a hostname, e.g. gitlab.example.com"),
    repo: z
      .string()
      .regex(GITLAB_REPO_SHAPE, "repo must be a full path like 'group/name'")
      .optional(),
    streams: z.array(z.enum(["issues", "pulls", "ci"])).default(["issues", "pulls"]),
    username: z.string().min(1),
  })
  .strict();
export type GitLabConfig = z.infer<typeof GitLabConfigSchema>;

/**
 * Google Calendar config — which calendar to poll (`calendarId`, defaults to the
 * service account's `primary`) and how far ahead to look (`lookaheadDays`). Auth is
 * a Google service account: the SA JSON key lives in the credentials store as the
 * single `token`, never here; the operator shares the calendar with the SA's email
 * (no domain-wide delegation needed for a personal calendar). `.strict()` — same
 * containment as the other configs.
 */
export const CalendarConfigSchema = z
  .object({
    kind: z.literal("calendar"),
    calendarId: z.string().min(1).default("primary"),
    lookaheadDays: z.number().int().positive().max(365).default(14),
  })
  .strict();
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;

/**
 * Sentry config (NS2 F7a) — the first monitor-ONLY integration kind. `org` +
 * `project` are Sentry slugs; the auth token lives in the credentials store
 * (`token`, like Slack/Jira/GitHub). `baseUrl` overrides the SaaS host for
 * self-hosted (default https://sentry.io). `minLevel` is the actionability floor:
 * only issues at or above it become alerts (→ tier path); quieter issues stay in
 * Sentry's own UI (the adapter's analogue of github-ci emitting only red runs).
 * `.strict()` — no token-shaped key can leak into the committed entity file.
 */
export const SentryConfigSchema = z
  .object({
    kind: z.literal("sentry"),
    org: z.string().min(1),
    project: z.string().min(1),
    baseUrl: z.string().url().optional(),
    minLevel: z.enum(["warning", "error", "fatal"]).default("error"),
  })
  .strict();
export type SentryConfig = z.infer<typeof SentryConfigSchema>;

/** Discriminated on `kind` so config always matches the integration kind. */
export const IntegrationConfigSchema = z.discriminatedUnion("kind", [
  SlackConfigSchema,
  EmailConfigSchema,
  JiraConfigSchema,
  GitHubConfigSchema,
  GitLabConfigSchema,
  CalendarConfigSchema,
  SentryConfigSchema,
]);
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

/** Connection health, watcher-stamped (`markSync`), like an automation's lastFiredAt. */
export const IntegrationStatusSchema = z.enum(["connected", "disconnected", "error"]);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

/**
 * An account stores no repo — its repos follow from the projects it serves. `config.repo`
 * is the watcher's runtime poll scope only, so a create body carrying one is rejected
 * (the controller applies the same rule to updates).
 */
function rejectStoredRepo(data: { config: IntegrationConfig }, ctx: z.RefinementCtx): void {
  const { config } = data;
  if ((config.kind === "github" || config.kind === "gitlab") && config.repo !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `a ${config.kind} account has no repo — set the project's gitRemote instead`,
      path: ["config", "repo"],
    });
  }
}

/**
 * True for the operator's personal account (no owning company). Personal accounts feed
 * the operator-wide surfaces (briefing, mentions, widgets); see `PROJECT_SCOPED_KINDS`
 * for which of them also serve projects.
 */
export function isPersonalAccount(integration: { companyId?: string | undefined }): boolean {
  return integration.companyId === undefined;
}

/**
 * Kinds whose PERSONAL account also serves projects — the ones that live "at" a project
 * (its repo host, its board, its error tracker). A personal mailbox, calendar or Slack
 * login belongs to the operator alone and is never inherited by a project.
 */
export const PROJECT_SCOPED_KINDS: readonly IntegrationKind[] = [
  "github",
  "gitlab",
  "jira",
  "sentry",
];

/**
 * The un-refined object shape shared by the full entity and the create body —
 * kept separate from `IntegrationSchema` because `.superRefine` returns a
 * `ZodEffects`, which cannot `.omit()`/`.partial()` (needed below for the update
 * body).
 */
const IntegrationObjectSchema = z.object({
  id: IntegrationIdSchema,
  kind: IntegrationKindSchema,
  /**
   * The owner: a company `id`, or absent for the operator's PERSONAL account. An
   * integration is an account (identity + credential + streams); projects never own
   * one — they only say where things are (`gitRemote`, the team's `board`) and are
   * served by their company's accounts, then the operator's (`PROJECT_SCOPED_KINDS`).
   * The `id` is never re-keyed (it keys credentials, channel items, cursors, roadmap
   * ids), but the owner is free to change.
   */
  companyId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
  config: IntegrationConfigSchema,
  status: IntegrationStatusSchema.default("disconnected"),
  lastSyncAt: IsoDateTimeSchema.optional(),
  lastError: z.string().optional(),
  /**
   * When the access token expires, stamped by the connection test (GitHub's
   * `github-authentication-token-expiration` header). `null` = the token has no
   * expiry; absent = unknown (never tested, or the kind doesn't report it).
   */
  tokenExpiresAt: IsoDateTimeSchema.nullable().optional(),
  /** Computed at read time: whether a credentials file exists. Never persisted. */
  hasCredentials: z.boolean().default(false),
});

/**
 * A connected account (historically "integration"; the entity and its ids keep that
 * name). On disk: one `<id>.json` under
 * `data/integrations`. `status` / `lastSyncAt` / `lastError` are stamped by the
 * watcher and the connection test, never by a client. `hasCredentials` is computed
 * at read time from the separate gitignored credentials store — the secret itself
 * is never stored on, nor served from, the entity (Law 3 / credentials hygiene).
 */
export const IntegrationSchema = IntegrationObjectSchema;
export type Integration = z.infer<typeof IntegrationObjectSchema>;

/**
 * Create body — the operator supplies id, kind, config and the owner (`companyId`, or
 * none for a personal account) (+ optional name/enabled). Status fields and
 * hasCredentials are server-owned, so they're omitted.
 */
const CreateIntegrationObjectSchema = z.object({
  id: IntegrationIdSchema,
  kind: IntegrationKindSchema,
  companyId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  config: IntegrationConfigSchema,
});
export const CreateIntegrationSchema = CreateIntegrationObjectSchema.superRefine(rejectStoredRepo);
export type CreateIntegrationInput = z.infer<typeof CreateIntegrationObjectSchema>;

/**
 * Update body — `id` and `kind` are immutable (kind drives the config union and
 * the adapter; changing it would orphan items + credentials), so both are omitted;
 * the rest is partial. `companyId: null` moves the account to the operator (personal).
 */
export const UpdateIntegrationSchema = IntegrationObjectSchema.omit({
  id: true,
  kind: true,
  status: true,
  lastSyncAt: true,
  lastError: true,
  tokenExpiresAt: true,
  hasCredentials: true,
})
  .partial()
  .extend({ companyId: z.string().min(1).nullable().optional() });
export type UpdateIntegrationInput = z.infer<typeof UpdateIntegrationSchema>;

/**
 * Closed, per-kind credentials write body. Slack carries a bot `token`, email a
 * `password` — nothing else parses, so a misdirected secret can't be stored under
 * the wrong key. Credentials are write-only over HTTP: there is no read endpoint.
 */
export const CredentialsInputSchema = z.union([
  z.object({ token: z.string().min(1) }).strict(),
  z.object({ password: z.string().min(1) }).strict(),
]);
export type CredentialsInput = z.infer<typeof CredentialsInputSchema>;

/** Result of a connection test — the adapter's verdict + a short human detail. */
export const TestResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string(),
  /** Token expiry the probe observed (see `Integration.tokenExpiresAt`); absent = not reported. */
  tokenExpiresAt: IsoDateTimeSchema.nullable().optional(),
});
export type TestResult = z.infer<typeof TestResultSchema>;
