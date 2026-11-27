"use client";

import { useEffect } from "react";
import type { BridgeWidgetProps } from "./registry";

interface Report {
  /** Still fetching — never reported as empty (avoids collapse/expand flicker). */
  loading: boolean;
  /** Item count; `undefined` while loading (header shows no count). */
  count: number | undefined;
  /** Items needing the operator. */
  you: number;
  /** Weighted non-"you" score terms (`PRIORITY_WEIGHT`), excluding anything already in `you`. */
  urgency?: number;
  /** Right-aligned header note. */
  aside?: string;
  /** Header sync button — `onRefresh` must be stable. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** The fetch failed — an error state is shown, so the widget must not collapse as empty. */
  failed?: boolean;
  /** Never report empty although `count` is 0 (e.g. a filter hides everything but the widget
   *  still holds data and its filter bar must stay reachable). Not an error state. */
  keepOpen?: boolean;
  /** Something is red — the frame gets a rose border. */
  alert?: boolean;
  /** A filter pick is applied — the header filters button shows its marker. */
  filtersActive?: boolean;
}

/** Feeds the frame: emptiness (never while loading) and the count / you / urgency / aside header info. */
export function useWidgetReport(
  {
    loading,
    count,
    you,
    urgency,
    aside,
    onRefresh,
    refreshing,
    failed,
    keepOpen,
    filtersActive,
    alert,
  }: Report,
  { onEmptyChange, onCountChange }: Pick<BridgeWidgetProps, "onEmptyChange" | "onCountChange">,
) {
  const empty = !loading && !count && !failed && !keepOpen;
  useEffect(() => onEmptyChange(empty), [empty, onEmptyChange]);
  useEffect(
    () =>
      onCountChange?.({
        count,
        you,
        urgency,
        loading,
        aside,
        onRefresh,
        refreshing,
        filtersActive,
        alert,
      }),
    [
      count,
      you,
      urgency,
      loading,
      aside,
      onRefresh,
      refreshing,
      filtersActive,
      alert,
      onCountChange,
    ],
  );
}
