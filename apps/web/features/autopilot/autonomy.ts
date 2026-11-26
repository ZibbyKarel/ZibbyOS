import {
  AUTOMATION_KEYS,
  type AutomationKey,
  type AutomationLevel,
  type AutomationLevels,
  type AutomationOverride,
  type AutopilotAutomation,
  type Company,
  NO_AUTOMATION,
  type Team,
} from "@zibby/contracts";
import type { ZibbyOrbState, ZibbyStatus } from "@zibby/design-system";

export { AUTOMATION_KEYS };

/**
 * The two columns of the levels table. They add up: Poloautomat is on for `semi` and `auto`,
 * Automat only for `auto` (Automat without Poloautomat does not exist).
 */
export type Column = "semi" | "auto";
export const COLUMNS: readonly Column[] = ["semi", "auto"];

export const inColumn = (level: AutomationLevel, column: Column) =>
  column === "semi" ? level !== "manual" : level === "auto";

/** What clicking a chip does: Poloautomat off -> manual (Automat goes too), Automat on -> auto (Poloautomat comes too). */
export const toggledLevel = (level: AutomationLevel, column: Column): AutomationLevel =>
  column === "semi"
    ? inColumn(level, "semi")
      ? "manual"
      : "semi"
    : inColumn(level, "auto")
      ? "semi"
      : "auto";

/** The level every global capability shares; `null` when they differ (mixed). */
export const sharedLevel = (automation: AutopilotAutomation): AutomationLevel | null => {
  const levels = new Set(AUTOMATION_KEYS.map((k) => automation.global[k]));
  return levels.size === 1 ? ([...levels][0] ?? null) : null;
};

/** Full Automat: every global capability is on `auto`. */
export const isFullAuto = (automation: AutopilotAutomation) => sharedLevel(automation) === "auto";

/** Orb state per level on the autonomy slider (matches the pill: manual grey, semi violet, auto amber). */
export const LEVEL_ORB = { manual: "sleep", semi: "think", auto: "speak" } as const;

/** What the TopBar pill shows: the autonomy level, "mixed" when the global capabilities differ, or the pause. */
export type ZibbyPillKey = "paused" | AutomationLevel | "mixed";

/** Paused wins; a `null` shared level is mixed. */
export const pillKey = (paused: boolean, level: AutomationLevel | null): ZibbyPillKey =>
  paused ? "paused" : (level ?? "mixed");

/** The DS tone of the pill (a colour, never shown as text): grey paused or manual, amber auto, else violet. */
export const pillTone = (key: ZibbyPillKey): ZibbyStatus =>
  key === "paused" || key === "manual" ? "paused" : key === "auto" ? "auto" : "run";

/** Orb state of the pill and the menu head per key (matches `LEVEL_ORB`). */
export const PILL_ORB: Record<ZibbyPillKey, ZibbyOrbState> = {
  paused: "sleep",
  manual: "sleep",
  semi: "think",
  auto: "speak",
  mixed: "think",
};

export const EMPTY_AUTOMATION: AutopilotAutomation = {
  global: { ...NO_AUTOMATION },
  companies: {},
  teams: {},
  projects: {},
};

/** Merge `inherited` <- `override` (an absent key inherits). */
export const applyOverride = (
  inherited: AutomationLevels,
  override: AutomationOverride | undefined,
): AutomationLevels => {
  const out = { ...inherited };
  for (const k of AUTOMATION_KEYS) out[k] = override?.[k] ?? out[k];
  return out;
};

export const hasOverride = (override: AutomationOverride | undefined) =>
  !!override && Object.keys(override).length > 0;

export type ScopeKind = "global" | "company" | "team";

export interface AutonomyScope {
  /** `global` / `company:<id>` / `team:<id>`: also the row key. */
  node: string;
  kind: ScopeKind;
  id: string;
  label: string;
  /** The node this one inherits from; `null` for the global row. */
  parent: string | null;
  /** Owning company's name, for the team subtitle. */
  companyName?: string;
}

export const GLOBAL_NODE = "global";

/** Global first, then each company followed by its teams, then teams without a known company. */
export function buildScopes(companies: Company[], teams: Team[]): AutonomyScope[] {
  const companyIds = new Set(companies.map((c) => c.id));
  const team = (tm: Team, parent: string, companyName?: string): AutonomyScope => ({
    node: `team:${tm.id}`,
    kind: "team",
    id: tm.id,
    label: tm.name,
    parent,
    ...(companyName ? { companyName } : {}),
  });
  return [
    { node: GLOBAL_NODE, kind: "global", id: GLOBAL_NODE, label: "", parent: null },
    ...companies.flatMap((c): AutonomyScope[] => [
      { node: `company:${c.id}`, kind: "company", id: c.id, label: c.name, parent: GLOBAL_NODE },
      ...teams
        .filter((tm) => tm.companyId === c.id)
        .map((tm) => team(tm, `company:${c.id}`, c.name)),
    ]),
    ...teams
      .filter((tm) => !tm.companyId || !companyIds.has(tm.companyId))
      .map((tm) => team(tm, GLOBAL_NODE)),
  ];
}

/** The scope's own (possibly absent) override. The global row is the base, it has none. */
export function overrideOf(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
): AutomationOverride | undefined {
  if (scope.kind === "company") return automation.companies[scope.id];
  if (scope.kind === "team") return automation.teams[scope.id];
  return undefined;
}

/** Effective levels of every scope, resolved top-down from the global row. */
export function effectiveByNode(
  automation: AutopilotAutomation,
  scopes: AutonomyScope[],
): Record<string, AutomationLevels> {
  const out: Record<string, AutomationLevels> = {};
  for (const scope of scopes) {
    out[scope.node] =
      scope.kind === "global"
        ? { ...automation.global }
        : applyOverride(
            (scope.parent ? out[scope.parent] : undefined) ?? automation.global,
            overrideOf(automation, scope),
          );
  }
  return out;
}

const bucket = (scope: AutonomyScope) => (scope.kind === "company" ? "companies" : "teams");

/** Replace one company/team override (an empty one removes it). */
function withOverride(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
  next: AutomationOverride,
): AutopilotAutomation {
  const key = bucket(scope);
  const rest = { ...automation[key] };
  delete rest[scope.id];
  return { ...automation, [key]: hasOverride(next) ? { ...rest, [scope.id]: next } : rest };
}

/**
 * Set one capability of a scope. On the global row it rewrites the base; elsewhere a level equal
 * to the parent's effective one removes the override (the scope inherits again).
 */
export function setLevel(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
  parentEffective: AutomationLevels,
  key: AutomationKey,
  level: AutomationLevel,
): AutopilotAutomation {
  if (scope.kind === "global") {
    return { ...automation, global: { ...automation.global, [key]: level } };
  }
  const next: AutomationOverride = { ...overrideOf(automation, scope) };
  if (level === parentEffective[key]) delete next[key];
  else next[key] = level;
  return withOverride(automation, scope, next);
}

export const inheritAll = (automation: AutopilotAutomation, scope: AutonomyScope) =>
  scope.kind === "global" ? automation : withOverride(automation, scope, {});

/** Companies/teams that override something (the header menu and the levels page list them). */
export const exceptionsOf = (automation: AutopilotAutomation, scopes: AutonomyScope[]) =>
  scopes.filter((scope) => hasOverride(overrideOf(automation, scope)));

/** The capabilities that resolve to `manual` (nothing is started, the operator does it). */
export const manualKeys = (levels: AutomationLevels): AutomationKey[] =>
  AUTOMATION_KEYS.filter((k) => levels[k] === "manual");
