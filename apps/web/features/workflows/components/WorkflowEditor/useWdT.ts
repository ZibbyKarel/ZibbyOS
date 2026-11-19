"use client";
import { useTranslations } from "next-intl";

export type WdT = (key: string, values?: Record<string, string | number>) => string;

/**
 * Translator for the `workflowDetail.*` catalog. Its keys live in
 * `apps/web/i18n/messages/pending/workflow-detail.{cs,en}.json` until the orchestrator merges
 * them into the main catalogs, so the typed `useTranslations` can't know them yet — this hook
 * is the single untyped seam (swap it for `useTranslations` once merged).
 */
export function useWdT(namespace: string): WdT {
  return useTranslations(namespace as never) as unknown as WdT;
}
