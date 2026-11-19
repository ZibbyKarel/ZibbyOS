import { AppHeaderTestId, ZibbyChipTestId } from "@zibby/design-system";

export interface ZibbyOrigin {
  x: number;
  y: number;
}

/**
 * Viewport centre of the mini orb in the app header — the point Zibby's orb flies out of
 * and back into. `null` when the header has no mini orb (phone toolbar) or it is not laid out.
 */
export function readOrbOrigin(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): ZibbyOrigin | null {
  if (!doc) return null;
  const orb = doc.querySelector(
    `[data-testid="${AppHeaderTestId.Root}"] [data-testid="${ZibbyChipTestId.Orb}"]`,
  );
  if (!orb) return null;
  const rect = orb.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
