import {
  type AutomationKey,
  type AutomationOverride,
  type AutomationToggles,
  type AutopilotAutomation,
  type Company,
  NO_AUTOMATION,
  type Team,
} from "@zibby/contracts";

/** Capabilities in display order (the five booleans of one automation node). */
export const AUTOMATION_KEYS: readonly AutomationKey[] = [
  "autoReview",
  "autoAddressComments",
  "autoImplement",
  "autoCommunicate",
  "autoFixCi",
];

/**
 * The design's three lanes. At cell level the data has two states per capability: `false` means
 * the work is never started (`manual`), `true` means it starts on its own (`auto`). `semi` ("start,
 * but always wait") is not representable today, so no cell is ever in it (no contract change).
 */
export type Lane = "manual" | "semi" | "auto";
export const LANES: readonly Lane[] = ["manual", "semi", "auto"];

export const laneOf = (on: boolean): Lane => (on ? "auto" : "manual");

export const EMPTY_AUTOMATION: AutopilotAutomation = {
  global: { ...NO_AUTOMATION },
  companies: {},
  teams: {},
};

/** Merge `inherited` <- `override` (an absent key inherits). */
export const applyOverride = (
  inherited: AutomationToggles,
  override: AutomationOverride | undefined,
): AutomationToggles => {
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

/** The scope's own (possibly absent) override. `global` never has one: the web forces it all-off. */
export function overrideOf(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
): AutomationOverride | undefined {
  if (scope.kind === "company") return automation.companies[scope.id];
  if (scope.kind === "team") return automation.teams[scope.id];
  return undefined;
}

/** Effective toggles of every scope, resolved top-down (the root is all-off). */
export function effectiveByNode(
  automation: AutopilotAutomation,
  scopes: AutonomyScope[],
): Record<string, AutomationToggles> {
  const out: Record<string, AutomationToggles> = {};
  for (const scope of scopes) {
    const inherited = scope.parent ? (out[scope.parent] ?? NO_AUTOMATION) : NO_AUTOMATION;
    out[scope.node] =
      scope.kind === "global"
        ? { ...NO_AUTOMATION }
        : applyOverride(inherited, overrideOf(automation, scope));
  }
  return out;
}

const level = (scope: AutonomyScope) => (scope.kind === "company" ? "companies" : "teams");

/** Replace one scope's override map (an empty map removes it). Global is forced all-off. */
function withOverride(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
  next: AutomationOverride,
): AutopilotAutomation {
  if (scope.kind === "global") return automation;
  const key = level(scope);
  const rest = { ...automation[key] };
  delete rest[scope.id];
  return {
    ...automation,
    global: { ...NO_AUTOMATION },
    [key]: hasOverride(next) ? { ...rest, [scope.id]: next } : rest,
  };
}

/**
 * Put one capability of a scope into a lane. `auto` = `true`, `manual` = `false`; a value equal to
 * the parent's effective one removes the override (the scope inherits again). `semi` and the
 * global row are no-ops (the caller never offers them).
 */
export function moveCap(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
  parentEffective: AutomationToggles,
  key: AutomationKey,
  lane: Lane,
): AutopilotAutomation {
  if (lane === "semi" || scope.kind === "global") return automation;
  const next: AutomationOverride = { ...overrideOf(automation, scope) };
  const value = lane === "auto";
  if (value === parentEffective[key]) delete next[key];
  else next[key] = value;
  return withOverride(automation, scope, next);
}

export function inheritCap(
  automation: AutopilotAutomation,
  scope: AutonomyScope,
  key: AutomationKey,
): AutopilotAutomation {
  const next: AutomationOverride = { ...overrideOf(automation, scope) };
  delete next[key];
  return withOverride(automation, scope, next);
}

export const inheritAll = (automation: AutopilotAutomation, scope: AutonomyScope) =>
  withOverride(automation, scope, {});

export interface ScopeException {
  scope: AutonomyScope;
  /** Overridden capabilities with their lane. */
  entries: { key: AutomationKey; lane: Lane }[];
}

/** Companies/teams that override something: shown in the Automat confirm and the levels link. */
export function exceptionsOf(
  automation: AutopilotAutomation,
  scopes: AutonomyScope[],
): ScopeException[] {
  return scopes.flatMap((scope) => {
    const own = overrideOf(automation, scope);
    const entries = AUTOMATION_KEYS.flatMap((key) =>
      own?.[key] === undefined ? [] : [{ key, lane: laneOf(own[key]) }],
    );
    return entries.length > 0 ? [{ scope, entries }] : [];
  });
}

/** True when some company/team has any capability on (Automat does something). */
export const anyCapOn = (automation: AutopilotAutomation) =>
  [...Object.values(automation.companies), ...Object.values(automation.teams)].some((node) =>
    Object.values(node).includes(true),
  );

const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, stable(x)]),
        )
      : v;

/** Structural equality of two trees, ignoring key order (a missing tree never equals one). */
export const sameAutomation = (
  a: AutopilotAutomation | undefined,
  b: AutopilotAutomation | undefined,
) => a !== undefined && b !== undefined && JSON.stringify(stable(a)) === JSON.stringify(stable(b));
