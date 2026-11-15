import { AppHeaderTestId, BrandMarkTestId } from "@zibby/design-system";

export interface ZibbyOrigin {
  x: number;
  y: number;
}

/**
 * Viewport centre of the logo's knot in the app header — the point Zibby's orb flies out of
 * and back into. `null` when the header has no BrandMark (phone toolbar) or it is not laid out.
 */
export function readKnotOrigin(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): ZibbyOrigin | null {
  if (!doc) return null;
  const knot = doc.querySelector(
    `[data-testid="${AppHeaderTestId.Root}"] [data-testid="${BrandMarkTestId.Knot}"]`,
  );
  if (!knot) return null;
  const rect = knot.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
