"use client";

import { createContext, useContext } from "react";

/** Opens the global NoteDock (the "Nový → Nová poznámka" window mounted by AppShell). */
const OpenNoteDockContext = createContext<() => void>(() => {});

export const OpenNoteDockProvider = OpenNoteDockContext.Provider;
export const useOpenNoteDock = () => useContext(OpenNoteDockContext);
