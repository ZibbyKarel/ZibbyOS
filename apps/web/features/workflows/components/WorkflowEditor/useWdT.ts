"use client";
import { useTranslations } from "next-intl";

/** `t(key, values)` over a `workflowDetail.*` namespace; keys are often built dynamically, hence loosely typed. */
export type WdT = (key: string, values?: Record<string, string | number>) => string;

export function useWdT(namespace: string): WdT {
  return useTranslations(namespace as never) as unknown as WdT;
}
