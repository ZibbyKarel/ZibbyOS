import { ZibbySectionTestId } from "@zibby/design-system";

export interface ZibbyOrigin {
  x: number;
  y: number;
}

/**
 * Viewport centre of the orb in the header's Zibby section (`ZibbyModeControl`) — the point Zibby's orb flies out of
 * and back into. `null` when that orb is not rendered or not laid out.
 */
export function readOrbOrigin(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): ZibbyOrigin | null {
  if (!doc) return null;
  const orb = doc.querySelector(`[data-testid="${ZibbySectionTestId.OrbSlot}"]`);
  if (!orb) return null;
  const rect = orb.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
