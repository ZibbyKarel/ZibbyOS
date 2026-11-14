import type { WidgetTier } from "@zibby/design-system";
import { useMemo } from "react";
import type { BridgeWidget } from "../grid/layout";
import { type PriorityInput, widgetTiers } from "../grid/priority";

/** Tier of every widget on the board, recomputed when layout / reports / collapse change. */
export function useWidgetPriority(
  layout: readonly BridgeWidget[],
  info: Readonly<Record<string, PriorityInput | undefined>>,
  empty: Readonly<Record<string, boolean | undefined>>,
  collapsed: Readonly<Record<string, boolean | undefined>>,
): Record<string, WidgetTier> {
  return useMemo(
    () => widgetTiers(layout, info, empty, collapsed),
    [layout, info, empty, collapsed],
  );
}
