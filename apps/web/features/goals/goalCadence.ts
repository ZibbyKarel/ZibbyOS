import type { GoalCadence } from "@zibby/contracts";

// ponytail: mirrors apps/api/src/goals/goal-cadence.ts (nextCycleStart); fold both into
// @zibby/contracts if a third caller shows up.
const TZ = "Europe/Prague";
const DAY_MS = 24 * 60 * 60 * 1000;

function pragueParts(at: Date): { y: number; m: number; d: number; h: number; min: number } {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at))
    p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    min: Number(p.minute),
  };
}

function offsetAt(at: number): number {
  const p = pragueParts(new Date(at));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(at / 60_000) * 60_000;
}

function pragueInstant(y: number, m: number, d: number, hour: number): Date {
  const guess = Date.UTC(y, m - 1, d, hour);
  return new Date(guess - offsetAt(guess - offsetAt(guess)));
}

function qualifies(every: GoalCadence["every"], y: number, m: number, d: number): boolean {
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (every === "day") return true;
  if (every === "weekday") return weekday !== 0 && weekday !== 6;
  return every === "week" ? weekday === 1 : d === 1;
}

/** The first cadence boundary strictly after `from` (Prague wall clock), or null if none within 40 days. */
export function nextCycleStart(cadence: GoalCadence, from: Date): Date | null {
  const start = pragueParts(from);
  const base = Date.UTC(start.y, start.m - 1, start.d);
  for (let i = 0; i <= 40; i++) {
    const day = new Date(base + i * DAY_MS);
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    if (!qualifies(cadence.every, y, m, d)) continue;
    const at = pragueInstant(y, m, d, cadence.hour);
    if (at.getTime() > from.getTime()) return at;
  }
  return null;
}
