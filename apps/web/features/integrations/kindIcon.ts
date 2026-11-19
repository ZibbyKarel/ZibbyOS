import type { IntegrationKind, RoadmapSourceKind } from "@zibby/contracts";
import type { IconName } from "@zibby/design-system";

export const INTEGRATION_GLYPH = {
  slack: "plug",
  email: "server",
  jira: "checkpoint",
  github: "branch",
  gitlab: "gitlab",
  calendar: "clock",
  sentry: "bolt",
} as const;

/**
 * Per-kind brand mark, preferred over {@link INTEGRATION_GLYPH} on the leading
 * tile (`IconTile` falls back to the glyph automatically on a missing key or a
 * failed image load). `slack` has no entry — Simple Icons pulled the mark from
 * its registry after a trademark request, see `tools/brand-logos/README.md` —
 * so it always renders its `plug` glyph. `email` has no entry either: the kind
 * is generic IMAP/SMTP, not Gmail, so it keeps its `server` glyph too.
 */
export const INTEGRATION_LOGO: Partial<Record<IntegrationKind, string>> = {
  github: "/logos/github.svg",
  jira: "/logos/jira.svg",
  calendar: "/logos/calendar.svg",
  sentry: "/logos/sentry.svg",
};

/** Icon of a roadmap item's or channel item's source; `manual` has no integration, so just a glyph. */
export function sourceIcon(kind: RoadmapSourceKind | IntegrationKind): {
  glyph: IconName;
  src?: string;
} {
  if (kind === "manual") return { glyph: "edit" };
  // The GitHub mark is a white-filled <img>, invisible on the light theme's panel — glyph only.
  if (kind === "github") return { glyph: INTEGRATION_GLYPH.github };
  return { glyph: INTEGRATION_GLYPH[kind], src: INTEGRATION_LOGO[kind] };
}

/** Brand marks the DS draws as monochrome icons (the bridge's source glyphs: Jira, GitHub, GitLab). */
export function brandSourceIcon(kind: RoadmapSourceKind | IntegrationKind): IconName {
  return kind === "jira" || kind === "github" || kind === "gitlab" ? kind : sourceIcon(kind).glyph;
}

/** Brand accent per service (design token colours only) — the top edge of an own connection tile. */
export const INTEGRATION_ACCENT: Record<IntegrationKind, string> = {
  jira: "var(--color-state-think)",
  slack: "var(--color-state-err)",
  github: "var(--color-ink-2)",
  gitlab: "var(--color-warn)",
  calendar: "var(--color-state-think)",
  sentry: "var(--color-state-work)",
  email: "var(--color-ok)",
};

/** Root-namespace i18n key of each kind's display name. */
export const INTEGRATION_KIND_LABEL_KEY = {
  slack: "integrations.kindSlack",
  email: "integrations.kindEmail",
  jira: "integrations.kindJira",
  github: "integrations.kindGithub",
  gitlab: "integrations.kindGitlab",
  calendar: "integrations.kindCalendar",
  sentry: "integrations.kindSentry",
} as const satisfies Record<IntegrationKind, string>;
