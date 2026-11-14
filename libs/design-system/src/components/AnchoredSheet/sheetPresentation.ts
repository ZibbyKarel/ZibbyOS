"use client";

import { createContext, useContext } from "react";

/**
 * How an `AnchoredSheet` presents itself: `anchored` = beside a row (desktop), `page` = a
 * full-screen page with a back button and a pinned action bar (phone).
 */
export type SheetPresentation = "anchored" | "page";

/** Lets a host switch every sheet below it to a presentation without touching the sheet bodies. */
export const SheetPresentationContext = createContext<SheetPresentation>("anchored");

export const useSheetPresentation = () => useContext(SheetPresentationContext);
