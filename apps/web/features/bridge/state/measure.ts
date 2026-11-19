/** The rect fields `measure` reads — a DOMRect satisfies it. */
export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
}

/** Boards narrower than this (px) are phones: the sheet is full-width. */
const PHONE_BOARD_MAX = 768;

/** Where the detail sheet sits, in px relative to the screen root. */
export interface SheetAnchor {
  side: "r" | "l";
  left: number;
  width: number;
  top: number;
  height: number;
  /** Eraser strip: left (inside the sheet), top (below the 4px top border), height. */
  eL: number;
  eT: number;
  eH: number;
}

/** Preferred sheet width (px) per selection kind — D14. */
export const SHEET_WIDTH: Record<string, number> = {
  pr: 640,
  run: 800,
  issue: 480,
  task: 480,
  automation: 480,
  project: 480,
  quickAction: 400,
  note: 400,
  vaultNote: 640,
  approval: 640,
};

export interface MeasureOptions {
  /** Preferred width; clamped to the free space beside the row. Omitted = all of it. */
  width?: number;
  /**
   * Expanded: the sheet takes everything except 3 of the 12 grid columns on the anchor side.
   * `grid` = the board's placement surface (its left / right), the columns' reference.
   */
  expanded?: boolean;
  grid?: Pick<RectLike, "left" | "right">;
}

/**
 * Open on whichever side of the row has more room — right (left edge = row's right edge) on a tie,
 * else left (right edge = row's left edge), as wide as `width` allows. Vertical extent is
 * the board top to the root bottom. The 3px eraser covers the shared edge at the row's height.
 */
export function measureSheet(
  root: RectLike,
  row: RectLike,
  board: RectLike,
  { width: pref, expanded = false, grid }: MeasureOptions = {},
): SheetAnchor {
  // A phone-width board has no room beside a row: the sheet takes the full width.
  if (root.right - root.left < PHONE_BOARD_MAX) {
    const width = root.right - root.left;
    return {
      side: "r",
      left: 0,
      width,
      top: board.top - root.top,
      height: root.bottom - board.top,
      eL: -2,
      eT: row.top - board.top - 4,
      eH: 0,
    };
  }
  const rightSpace = root.right - row.right;
  const leftSpace = row.left - root.left;
  const side = rightSpace >= leftSpace ? "r" : "l";
  const vertical = { top: board.top - root.top, height: root.bottom - board.top };
  if (expanded) {
    // ponytail: 3 columns ≈ a quarter of the grid surface (ignores the gaps), exact enough to keep the anchored widget's edge in view.
    const g = grid ?? root;
    const keep = (g.right - g.left) / 4;
    const left = side === "r" ? g.left - root.left + keep : 0;
    const width = side === "r" ? root.right - root.left - left : g.right - root.left - keep;
    return { side, left, width, ...vertical, eL: 0, eT: 0, eH: 0 };
  }
  const room = (side === "r" ? rightSpace : leftSpace) + 1;
  const width = Math.min(pref ?? room, room);
  const left = side === "r" ? row.right - root.left - 1 : row.left - root.left + 1 - width;
  return {
    side,
    left,
    width,
    ...vertical,
    eL: side === "r" ? -2 : width - 2,
    eT: row.top - board.top - 4,
    eH: row.height,
  };
}

/** True when any numeric field moved more than half a pixel (or the side flipped). */
export function anchorChanged(a: SheetAnchor, b: SheetAnchor | null): boolean {
  if (!b) return true;
  return (
    a.side !== b.side ||
    (["left", "width", "top", "height", "eL", "eT", "eH"] as const).some(
      (k) => Math.abs(a[k] - b[k]) > 0.5,
    )
  );
}
