import type { Integration, IntegrationKind } from "@zibby/contracts";

/** Where a tile's account is owned, relative to the page it is shown on. */
export type ConnectionOrigin = "own" | "inherited";
/** Health of one connection: drives the dot, the status copy and the "needs attention" sentence. */
export type ConnectionHealth = "ok" | "warn" | "bad" | "off";

export interface ConnectionTileModel {
  integration: Integration;
  origin: ConnectionOrigin;
  health: ConnectionHealth;
  /** Whole days until the token expires; set only while it is within {@link EXPIRY_WARN_DAYS}. */
  expiresInDays?: number;
  /** Projects reached by this account (shown on the company page; else 0). */
  serves: number;
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

export interface ExpiringToken {
  integration: Integration;
  /** Whole days left (rounded up); 0 = already expired. */
  daysLeft: number;
  expired: boolean;
}

/**
 * Enabled integrations whose token has a known expiry within {@link EXPIRY_WARN_DAYS} (or is past
 * it) — soonest first. No expiry (`null`) / unknown (absent) never qualifies.
 */
export function expiringTokens(integrations: readonly Integration[], now: number): ExpiringToken[] {
  return integrations
    .flatMap((integration) => {
      if (!integration.enabled || !integration.tokenExpiresAt) return [];
      const left = Date.parse(integration.tokenExpiresAt) - now;
      if (left > EXPIRY_WARN_DAYS * DAY_MS) return [];
      return [{ integration, daysLeft: Math.max(0, Math.ceil(left / DAY_MS)), expired: left <= 0 }];
    })
    .sort(
      (a, b) =>
        Date.parse(a.integration.tokenExpiresAt ?? "") -
        Date.parse(b.integration.tokenExpiresAt ?? ""),
    );
}

export interface ConnectionsModel {
  tiles: ConnectionTileModel[];
  connected: number;
  /** Tiles that are not healthy (error / expiring / expired), errors first. */
  attention: ConnectionTileModel[];
  /** Subset of `attention` that is down (error or expired). */
  down: ConnectionTileModel[];
}

/**
 * The connections strip of a company / project / team page. Pure: the caller passes the
 * accounts already scoped to the page — a company's own accounts, or the server-resolved set
 * that serves a project — and how they relate to it (`origin`).
 */
export function buildConnections(
  integrations: readonly Integration[],
  origin: ConnectionOrigin,
  now: number,
  serves = 0,
): ConnectionsModel {
  const tiles = integrations.map((integration) => ({
    integration,
    origin,
    serves,
    ...connectionHealth(integration, now),
  }));
  const rank = { bad: 0, warn: 1, off: 2, ok: 3 } as const;
  const attention = tiles
    .filter((t) => t.health === "bad" || t.health === "warn")
    .sort((a, b) => rank[a.health] - rank[b.health]);
  return {
    tiles,
    connected: tiles.filter((t) => t.health === "ok" || t.health === "warn").length,
    attention,
    down: attention.filter((t) => t.health === "bad"),
  };
}

/**
 * The service marks of a company's project rows: the kinds of the company's accounts. A
 * per-project resolved set (which would add the operator's personal accounts) is not loaded
 * for list rows.
 */
export function projectMarks(
  companyId: string | undefined,
  integrations: readonly Integration[],
): IntegrationKind[] {
  if (!companyId) return [];
  return [...new Set(integrations.filter((i) => i.companyId === companyId).map((i) => i.kind))];
}
