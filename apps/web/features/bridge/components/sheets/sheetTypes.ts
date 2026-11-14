import type { AnchoredSheetProps, StateTone } from "@zibby/design-system";
import type { SheetAnchor } from "../../state/measure";
import type { BridgeSelection } from "../../widgets/registry";

/** What every sheet receives from `DetailSheet`. */
export interface SheetProps {
  /** Item id (`BridgeSelection.id`). */
  id: string;
  anchor: SheetAnchor;
  onClose: () => void;
  /** Opens another entity (issue / PR / run) in this sheet; absent outside the bridge. */
  onOpen?: (selection: BridgeSelection) => void;
  /** Frame state from `DetailSheet` (back stack, row stepping, expand); absent outside the bridge. */
  frame?: SheetFrame;
}

/** What `DetailSheet` hands every sheet for the shared frame. */
export interface SheetFrame {
  /** Back / step / copy props spread onto `AnchoredSheet` (with their labels). */
  nav: Pick<
    AnchoredSheetProps,
    | "onBack"
    | "backLabel"
    | "backAriaLabel"
    | "onStep"
    | "stepPosition"
    | "stepPrevLabel"
    | "stepNextLabel"
    | "copyLabel"
    | "copiedLabel"
    | "expandLabel"
    | "shrinkLabel"
  >;
  /** Expanded = all but 3 grid columns wide (PR Changes tab, run ⤢). */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

const WIDGET = { issue: "issues", pr: "prs", run: "runs" } as const;

/** Selection for a cross-sheet jump. The target row may not be on the board — the sheet keeps its anchor. */
export const selectionFor = (kind: keyof typeof WIDGET, id: string): BridgeSelection => ({
  kind,
  id,
  widgetId: WIDGET[kind],
  key: `${WIDGET[kind]}:${id}`,
});

/** Geometry (+ the frame's nav props) for `AnchoredSheet`, from a measured anchor. */
export const geometry = (a: SheetAnchor, frame?: SheetFrame) => ({
  left: a.left,
  width: a.width,
  top: a.top,
  height: a.height,
  ...frame?.nav,
});

/** `TaskParentState` and friends are already DS tones; keep the type visible for callers. */
export type SheetStateTone = StateTone;
