import type { GoalCadence } from "@zibby/contracts";

/** Standing goals cut their cycles on the Prague wall clock (the cron/budget precedent). */
export const GOAL_TZ = "Europe/Prague";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Prague calendar fields of an instant. */
function pragueParts(at: Date): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: GOAL_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    min: Number(p.minute),
  };
}

/** Prague offset (ms ahead of UTC) at an instant. */
function offsetAt(at: number): number {
  const p = pragueParts(new Date(at));
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(at / 60_000) * 60_000;
}

/**
 * The instant of `hour:00` Prague on a calendar day. A wall time skipped by the spring
 * DST jump resolves to the hour after it; the doubled autumn hour resolves to one instant.
 */
export function pragueInstant(y: number, m: number, d: number, hour: number): Date {
  const guess = Date.UTC(y, m - 1, d, hour);
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

function qualifies(every: GoalCadence["every"], y: number, m: number, d: number): boolean {
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  switch (every) {
    case "day":
      return true;
    case "weekday":
      return weekday !== 0 && weekday !== 6;
    case "week":
      return weekday === 1;
    case "month":
      return d === 1;
  }
}

/**
 * The first cadence boundary strictly after `from`: `hour` Prague on every day, every
 * Mon–Fri, every Monday (`week`) or every 1st (`month`).
 */
export function nextCycleStart(cadence: GoalCadence, from: Date): Date {
  const start = pragueParts(from);
  const base = Date.UTC(start.y, start.m - 1, start.d);
  // A month cadence is at most 31 days away; 40 leaves room for nothing else.
  for (let i = 0; i <= 40; i++) {
    const day = new Date(base + i * DAY_MS);
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    if (!qualifies(cadence.every, y, m, d)) continue;
    const at = pragueInstant(y, m, d, cadence.hour);
    if (at.getTime() > from.getTime()) return at;
  }
  throw new Error(`no ${cadence.every} boundary within 40 days of ${from.toISOString()}`);
}

/**
 * The latest boundary in `(from, now]`, or `null` when none passed: a goal that missed
 * several boundaries (process down, enabled late) starts ONE cycle, anchored there.
 */
export function latestCycleStart(cadence: GoalCadence, from: Date, now: Date): Date | null {
  let latest: Date | null = null;
  for (
    let next = nextCycleStart(cadence, from);
    next <= now;
    next = nextCycleStart(cadence, next)
  ) {
    latest = next;
  }
  return latest;
}

/** Colleagues are messaged only Mon–Fri 9:00–17:00 Prague (spec "Anti-nagging"); 17:00 is out. */
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 17;

/** Whether `at` is inside Prague working hours. */
export function isWorkingHours(at: Date): boolean {
  const p = pragueParts(at);
  return qualifies("weekday", p.y, p.m, p.d) && p.h >= WORK_START_HOUR && p.h < WORK_END_HOUR;
}

/** The next working-day 9:00 Prague strictly after `at` (Friday 18:00 → Monday 9:00). */
export function nextWorkingStart(at: Date): Date {
  return nextCycleStart({ every: "weekday", hour: WORK_START_HOUR }, at);
}
