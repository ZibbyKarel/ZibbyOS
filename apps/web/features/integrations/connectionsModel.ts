import type { Integration, IntegrationKind } from "@zibby/contracts";

/** Where a tile's connection is owned, relative to the page it is shown on. */
export type ConnectionOrigin = "own" | "inherited";
/** Health of one connection: drives the dot, the status copy and the "needs attention" sentence. */
export type ConnectionHealth = "ok" | "warn" | "bad" | "off";

export interface ConnectionTileModel {
  integration: Integration;
  origin: ConnectionOrigin;
  health: ConnectionHealth;
  /** Whole days until the token expires; set only while it is within {@link EXPIRY_WARN_DAYS}. */
  expiresInDays?: number;
  /** Projects reached by this connection (company-owned: the company's projects; else 0). */
  serves: number;
}

export interface ConnectionScope {
  /** A company page: its own integrations, nothing inherited. */
  companyId?: string;
  /** A project page: its own + the company's (minus kinds the project overrides). */
  projectId?: string;
  /** Company a project / team belongs to. */
  parentCompanyId?: string;
  /** A team page: everything is inherited from the company (no team-level integrations yet). */
  teamPage?: boolean;
}

export interface ConnectionProject {
  id: string;
  name: string;
  companyId?: string;
  teamId?: string;
  gitRemote?: string;
}

export const EXPIRY_WARN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function connectionHealth(
  i: Integration,
  now: number,
): { health: ConnectionHealth; expiresInDays?: number } {
  if (i.status === "error") return { health: "bad" };
  if (!i.enabled || i.status === "disconnected") return { health: "off" };
  if (i.tokenExpiresAt) {
    const left = Date.parse(i.tokenExpiresAt) - now;
    if (left <= 0) return { health: "bad", expiresInDays: 0 };
    if (left <= EXPIRY_WARN_DAYS * DAY_MS) {
      return { health: "warn", expiresInDays: Math.ceil(left / DAY_MS) };
    }
  }
  return { health: "ok" };
}

export interface ConnectionsModel {
  tiles: ConnectionTileModel[];
  own: ConnectionTileModel[];
  inherited: ConnectionTileModel[];
  connected: number;
  /** Tiles that are not healthy (error / expiring / expired), errors first. */
  attention: ConnectionTileModel[];
  /** Subset of `attention` that is down (error or expired). */
  down: ConnectionTileModel[];
}

/**
 * The one place that decides what a company / project / team page shows in its
 * connections strip. Pure: takes the unfiltered integration + project lists.
 */
export function buildConnections(
  integrations: Integration[],
  projects: ConnectionProject[],
  scope: ConnectionScope,
  now: number,
): ConnectionsModel {
  const companyId = scope.companyId ?? scope.parentCompanyId;
  const companyIntegrations = integrations.filter((i) => companyId && i.companyId === companyId);
  const companyProjects = projects.filter((p) => companyId && p.companyId === companyId).length;
  const make = (i: Integration, origin: ConnectionOrigin): ConnectionTileModel => ({
    integration: i,
    origin,
    serves: i.companyId ? companyProjects : 0,
    ...connectionHealth(i, now),
  });

  let own: ConnectionTileModel[] = [];
  let inherited: ConnectionTileModel[] = [];
  if (scope.companyId) {
    own = companyIntegrations.map((i) => make(i, "own"));
  } else if (scope.projectId) {
    const mine = integrations.filter((i) => i.projectId === scope.projectId);
    const overridden = new Set<IntegrationKind>(mine.map((i) => i.kind));
    own = mine.map((i) => make(i, "own"));
    inherited = companyIntegrations
      .filter((i) => !overridden.has(i.kind))
      .map((i) => make(i, "inherited"));
  } else if (scope.teamPage) {
    inherited = companyIntegrations.map((i) => make(i, "inherited"));
  }
  const tiles = [...own, ...inherited];
  const rank = { bad: 0, warn: 1, off: 2, ok: 3 } as const;
  const attention = tiles
    .filter((t) => t.health === "bad" || t.health === "warn")
    .sort((a, b) => rank[a.health] - rank[b.health]);
  return {
    tiles,
    own,
    inherited,
    connected: tiles.filter((t) => t.health === "ok" || t.health === "warn").length,
    attention,
    down: attention.filter((t) => t.health === "bad"),
  };
}

/** Projects that inherit a company-owned integration (the disconnect-confirm list). */
export function inheritingProjects(
  integration: Integration,
  integrations: Integration[],
  projects: ConnectionProject[],
): ConnectionProject[] {
  if (!integration.companyId) return [];
  return projects.filter(
    (p) =>
      p.companyId === integration.companyId &&
      !integrations.some((i) => i.projectId === p.id && i.kind === integration.kind),
  );
}

export interface ProjectMark {
  kind: IntegrationKind;
  /** Owned by the project itself (filled mark) vs. inherited from the company (outlined). */
  own: boolean;
}

/** The service marks of one project row: own first, then the company's kinds it does not override. */
export function projectMarks(
  projectId: string,
  companyId: string | undefined,
  integrations: Integration[],
): ProjectMark[] {
  const own = [
    ...new Set(integrations.filter((i) => i.projectId === projectId).map((i) => i.kind)),
  ];
  const inherited = companyId
    ? [...new Set(integrations.filter((i) => i.companyId === companyId).map((i) => i.kind))].filter(
        (k) => !own.includes(k),
      )
    : [];
  return [
    ...own.map((kind) => ({ kind, own: true })),
    ...inherited.map((kind) => ({ kind, own: false })),
  ];
}
