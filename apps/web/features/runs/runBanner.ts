import type { RunMode } from "./runDetailModel";

/** The one banner a run detail shows under its header (spec §5: max one, needs-me or error only). */
export type RunBannerKind = "approval" | "question" | "error" | "parked" | "limit";

/**
 * Picks the run detail's single banner. A run is in exactly one mode, so the mode is the
 * severity pick; running, waiting, paused, stopped and done runs get none. Approval and
 * question act on the approval record, so without it there is no banner.
 */
export function pickRunBanner(mode: RunMode, hasApproval: boolean): RunBannerKind | null {
  switch (mode) {
    case "approval":
    case "question":
      return hasApproval ? mode : null;
    case "error":
    case "parked":
    case "limit":
      return mode;
    default:
      return null;
  }
}
