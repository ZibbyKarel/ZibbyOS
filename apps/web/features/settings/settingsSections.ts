/**
 * The `/system/settings/<section>` sections (ROUTE-MAP §3). Lives in its own
 * plain (non-`"use client"`) module rather than `Screen.tsx`: the owning server
 * page (`app/(company)/system/settings/[section]/page.tsx`) needs this array
 * at module init to validate the dynamic segment, and a plain value re-exported
 * from a `"use client"` file is not reliably readable from a server module
 * under the dev bundler's client/server boundary — it can read back as
 * `undefined` (`(SETTINGS_SECTIONS as readonly string[]).includes` throwing
 * "not a function") even though a production build works fine. Splitting the
 * pure constant out of the client component file sidesteps the boundary
 * entirely.
 *
 * Redesign v2: `ai-models` became `ai-engines`; `activity` folded into General
 * (the "Live log" panel). The legacy ids redirect (see the route page).
 */
export const SETTINGS_SECTIONS = ["general", "access", "ai-engines", "runtime", "status"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/** Old section ids → where they live now. */
export const LEGACY_SETTINGS_REDIRECTS: Record<string, string> = {
  "ai-models": "/system/settings/ai-engines",
  activity: "/system/settings/general#live-log",
};
