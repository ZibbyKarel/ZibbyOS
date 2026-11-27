"use client";

import { createContext, useContext } from "react";

/**
 * How an `AnchoredSheet` presents itself: `anchored` = beside a row (desktop), `page` = a
 * full-screen page with a back button and a pinned action bar (phone), `panel` = fills its positioned
 * parent (a docked side slot): no dimming, no resize / stepping / expand.
 */
export type SheetPresentation = "anchored" | "page" | "panel";

/** Lets a host switch every sheet below it to a presentation without touching the sheet bodies. */
export const SheetPresentationContext = createContext<SheetPresentation>("anchored");

export const useSheetPresentation = () => useContext(SheetPresentationContext);
