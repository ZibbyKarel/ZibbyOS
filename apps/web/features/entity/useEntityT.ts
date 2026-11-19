"use client";

import { useTranslations } from "next-intl";

type Values = Record<string, string | number>;
export type EntityT = (key: string, values?: Values) => string;

/** Translator for the `entity.*` namespace of the Entity Detail screens (loosely keyed). */
export function useEntityT(): EntityT {
  return useTranslations("entity") as unknown as EntityT;
}
