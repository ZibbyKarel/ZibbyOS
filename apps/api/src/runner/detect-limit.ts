/** Outcome of scanning a chunk of run output for a usage-limit signal. */
export interface LimitDetection {
  /** A usage-limit / rate-limit signal was present in the text. */
  hit: boolean;
  /** The reset time (epoch ms) when the output carried one, else null. */
  resetsAt: number | null;
}

const NO_HIT: LimitDetection = { hit: false, resetsAt: null };

/**
 * Patterns that mark a usage/rate limit in a `claude` run's output, in priority
 * order — the first that matches wins (the most specific, which also carries the
 * reset epoch, is tried first).
 */
const PATTERNS = [
  /** Claude Code's own message, with a trailing reset epoch (seconds). */
  /Claude(?:\s+AI)?\s+usage\s+limit\s+reached\s*\|\s*(\d+)/i,
  /** The window message (also via opencode's `claude-agent/*`), with an ISO reset when named. */
  /You(?:'|’)ve\s+hit\s+your\s+(?:[\w-]+\s+){0,2}limit\b(?:[^\n"]*?Resets\s+at\s+(\d{4}-\d\d-\d\dT[\d:.]+Z))?/i,
  /** Same message without a parseable reset. */
  /Claude(?:\s+AI)?\s+usage\s+limit\s+reached/i,
  /** Generic rate-limit phrasing. */
  /\b(?:rate[- ]?limit(?:ed|ing)?|too\s+many\s+requests)\b/i,
  /** A bare HTTP 429. */
  /\b(?:HTTP\s*)?429\b/,
] as const;

/** A captured reset: epoch seconds or an ISO timestamp → epoch ms. */
function parseReset(reset: string | undefined): number | null {
  if (reset === undefined) return null;
  const ms = /^\d+$/.test(reset) ? Number(reset) * 1000 : Date.parse(reset);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Scan a chunk of `claude` run output for a usage-limit signal (Layer 2 of the
 * limit tracker). Pure. When the most specific pattern matches it also extracts
 * the reset epoch and returns it as `resetsAt` (epoch ms); the looser patterns
 * only flag the hit. A hit busts the limits cache so the next read re-fetches the
 * authoritative percentages.
 */
export function detectLimit(text: string): LimitDetection {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    return { hit: true, resetsAt: parseReset(match[1]) };
  }
  return NO_HIT;
}
