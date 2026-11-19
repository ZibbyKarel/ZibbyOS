import { type BrandMarkState, stateToneHex } from "@zibby/design-system";

/** Run statuses that mean "something waits for the operator". */
const WAITING = new Set(["awaiting-approval", "parked"]);

/**
 * The system state the brand mark / favicon shows: amber (`blocked`) when anything
 * waits on the operator, violet (`working`) while agents run, grey (`idle`) at rest.
 * Same rule the header knot uses (brand doc "Motýlek").
 */
export function deriveBrandState(input: {
  pendingApprovals: number;
  runStatuses: readonly string[];
}): BrandMarkState {
  if (input.pendingApprovals > 0 || input.runStatuses.some((s) => WAITING.has(s))) return "blocked";
  return input.runStatuses.includes("running") ? "working" : "idle";
}

/** The mark as a standalone SVG data URI — wings in a neutral ink, knot in the state
 *  colour. Hex values (a favicon cannot resolve CSS vars); the wing ink is the
 *  dark-theme wing colour because browser tab strips are usually dark-ish and the
 *  knot carries the signal. */
export function faviconDataUri(state: BrandMarkState): string {
  const knot = stateToneHex[state];
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<mask id="k" maskUnits="userSpaceOnUse" x="-8" y="-8" width="80" height="80">' +
    '<rect x="-8" y="-8" width="80" height="80" fill="#fff"/><circle cx="32" cy="32" r="8" fill="#000"/></mask>' +
    '<g fill="#8b919c" stroke="#8b919c" stroke-width="6" stroke-linejoin="round" mask="url(#k)">' +
    '<path d="M8 16L28.5 30V34L8 48Z"/><path d="M56 16L35.5 30V34L56 48Z"/></g>' +
    `<circle cx="32" cy="32" r="6.5" fill="${knot}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
