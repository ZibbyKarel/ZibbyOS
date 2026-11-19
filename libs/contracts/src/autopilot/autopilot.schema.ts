import { z } from "zod";
import { IsoDateTimeSchema } from "../common.schema";

/**
 * Autonomy (redesign v2, replaces the Phase 4 `level off|full` switch). Every capability has one
 * level per company/team: `manual` (ZIBBY doesn't do it), `semi` (ZIBBY picks the work up and
 * prepares it, the outcome waits for the operator's approval) or `auto` (ZIBBY also approves its
 * own outcome and reports it: Tier 2). `paused` is the emergency brake over the whole table:
 * nothing new starts and nothing is sent. Never-rules and merge are not affected by any level.
 */
export const AutomationLevelSchema = z.enum(["manual", "semi", "auto"]);
export type AutomationLevel = z.infer<typeof AutomationLevelSchema>;

/** manual < semi < auto: raising a cell needs the operator token, lowering never does. */
export const AUTOMATION_LEVEL_RANK: Readonly<Record<AutomationLevel, number>> = {
  manual: 0,
  semi: 1,
  auto: 2,
};

/** Who switched it: the dashboard with the operator token, or the operator chat (pause only). */
export const AutopilotActorSchema = z.enum(["operator", "chat"]);
export type AutopilotActor = z.infer<typeof AutopilotActorSchema>;

/**
 * The covered gate/approval classes, each following one capability's `auto` level
 * ({@link AUTOPILOT_SCOPE_TOGGLE}):
 * - `reviews` — post ZIBBY's finished PR code reviews;
 * - `comments` — address review comments: push the fixes, post the thread replies;
 * - `communication` — concrete replies in channels (GitHub/GitLab/Jira questions, Slack);
 * - `ci` — push a CI fix onto the operator's own PR, re-run flaky CI jobs.
 */
export const AutopilotScopeSchema = z
  .object({
    reviews: z.boolean(),
    comments: z.boolean(),
    communication: z.boolean(),
    ci: z.boolean(),
  })
  .strict();
export type AutopilotScope = z.infer<typeof AutopilotScopeSchema>;
export type AutopilotScopeKey = keyof AutopilotScope;

/**
 * The autonomy table, one Global -> Company -> Team override tree. Precedence
 * team > company > global. `semi` and `auto` start the work (`autoReview` /
 * `autoAddressComments` / `autoImplement` / `autoFixCi`); only `auto` also lets the gate overlay
 * act on its outcome. `autoCommunicate` starts nothing (channel items arrive on their own).
 */
export const AutomationLevelsSchema = z
  .object({
    autoReview: AutomationLevelSchema,
    autoAddressComments: AutomationLevelSchema,
    autoImplement: AutomationLevelSchema,
    autoCommunicate: AutomationLevelSchema.default("manual"),
    autoFixCi: AutomationLevelSchema.default("manual"),
  })
  .strict();
export type AutomationLevels = z.infer<typeof AutomationLevelsSchema>;
export type AutomationKey = keyof AutomationLevels;

/** Effective "does it start" flags per capability (a resolved cell is not `manual`, not paused). */
export type AutomationToggles = Record<AutomationKey, boolean>;

export const AUTOMATION_KEYS: readonly AutomationKey[] = [
  "autoReview",
  "autoAddressComments",
  "autoImplement",
  "autoCommunicate",
  "autoFixCi",
];

export const NO_AUTOMATION: AutomationLevels = {
  autoReview: "manual",
  autoAddressComments: "manual",
  autoImplement: "manual",
  autoCommunicate: "manual",
  autoFixCi: "manual",
};

/** The capability whose `auto` level each gate-overlay class follows. */
export const AUTOPILOT_SCOPE_TOGGLE: Readonly<Record<AutopilotScopeKey, AutomationKey>> = {
  reviews: "autoReview",
  comments: "autoAddressComments",
  communication: "autoCommunicate",
  ci: "autoFixCi",
};

/** A node's explicit choices; an absent key inherits from the level above. */
export const AutomationOverrideSchema = z
  .object({
    autoReview: AutomationLevelSchema,
    autoAddressComments: AutomationLevelSchema,
    autoImplement: AutomationLevelSchema,
    autoCommunicate: AutomationLevelSchema,
    autoFixCi: AutomationLevelSchema,
  })
  .partial()
  .strict();
export type AutomationOverride = z.infer<typeof AutomationOverrideSchema>;

/** `companies` / `teams` are keyed by company id / team id. */
export const AutopilotAutomationSchema = z
  .object({
    global: AutomationLevelsSchema,
    companies: z.record(z.string(), AutomationOverrideSchema).default({}),
    teams: z.record(z.string(), AutomationOverrideSchema).default({}),
  })
  .strict();
export type AutopilotAutomation = z.infer<typeof AutopilotAutomationSchema>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Read a pre-redesign `autopilot.json` (`level: off|full` + boolean toggles) as the new shape,
 * keeping behaviour: false -> manual; true -> auto when the level was `full`, else semi (an `off`
 * toggle started the work and waited for approval). A tree written before `autoCommunicate`
 * takes it from the stored `scope.communication`. A legacy state without a tree starts nothing.
 */
export function migrateLegacyAutopilotState(raw: unknown): unknown {
  if (!isRecord(raw) || !("level" in raw) || "paused" in raw) return raw;
  const full = raw.level === "full";
  const level = (v: unknown) =>
    typeof v === "boolean" ? (v ? (full ? "auto" : "semi") : "manual") : v;
  const node = (n: unknown) =>
    isRecord(n) ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, level(v)])) : n;
  const out: Record<string, unknown> = { paused: false };
  if (typeof raw.since === "string") out.since = raw.since;
  if (typeof raw.by === "string") out.by = raw.by;
  const tree = raw.automation;
  if (isRecord(tree)) {
    const global = node(tree.global);
    const scope = raw.scope;
    if (
      isRecord(global) &&
      global.autoCommunicate === undefined &&
      isRecord(scope) &&
      typeof scope.communication === "boolean"
    ) {
      global.autoCommunicate = level(scope.communication);
    }
    const map = (m: unknown) =>
      isRecord(m) ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, node(v)])) : m;
    out.automation = { global, companies: map(tree.companies), teams: map(tree.teams) };
  }
  return out;
}

/** `autopilot.json` — the on-disk state. Absent / garbage reads as `{ paused: false }` (all manual). */
export const AutopilotStateSchema = z.preprocess(
  migrateLegacyAutopilotState,
  z
    .object({
      paused: z.boolean(),
      since: IsoDateTimeSchema.optional(),
      by: AutopilotActorSchema.optional(),
      automation: AutopilotAutomationSchema.optional(),
    })
    .strict(),
);
export type AutopilotState = z.infer<typeof AutopilotStateSchema>;

/** Where an action happens in the automation tree; empty = global. */
export const AutopilotLocationSchema = z
  .object({ companyId: z.string().min(1).optional(), teamId: z.string().min(1).optional() })
  .strict();
export type AutopilotLocation = z.infer<typeof AutopilotLocationSchema>;

/** The resolved level of every capability at a company/team: global <- company <- team. */
export function resolveAutopilotLevels(
  state: Pick<AutopilotState, "automation">,
  at: { companyId?: string | undefined; teamId?: string | undefined },
): AutomationLevels {
  if (!state.automation) return { ...NO_AUTOMATION };
  const { global, companies, teams } = state.automation;
  const company = at.companyId ? companies[at.companyId] : undefined;
  const team = at.teamId ? teams[at.teamId] : undefined;
  const out = { ...global };
  for (const node of [company, team]) {
    if (!node) continue;
    for (const k of AUTOMATION_KEYS) {
      const v = node[k];
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

/** Which capabilities start work at a company/team: the cell is `semi` or `auto` and nothing is paused. */
export function resolveAutopilotAutomation(
  state: Pick<AutopilotState, "paused" | "automation">,
  at: { companyId?: string | undefined; teamId?: string | undefined },
): AutomationToggles {
  const levels = resolveAutopilotLevels(state, at);
  const out = {} as AutomationToggles;
  for (const k of AUTOMATION_KEYS) out[k] = !state.paused && levels[k] !== "manual";
  return out;
}

/** `GET/PUT /api/autopilot` — the state plus how many approvals are still pending (never auto-decided). */
export const AutopilotStatusSchema = z.object({
  paused: z.boolean(),
  since: IsoDateTimeSchema.optional(),
  by: AutopilotActorSchema.optional(),
  automation: AutopilotAutomationSchema.optional(),
  pendingApprovals: z.number().int().min(0),
});
export type AutopilotStatus = z.infer<typeof AutopilotStatusSchema>;

export const SetAutopilotInputSchema = z
  .object({
    /** Omitted = keep. Pausing never needs the token; resuming does. */
    paused: z.boolean().optional(),
    /** Omitted = keep the stored tree. Raising any cell needs the operator token. */
    automation: AutopilotAutomationSchema.optional(),
  })
  .strict();
export type SetAutopilotInput = z.infer<typeof SetAutopilotInputSchema>;
