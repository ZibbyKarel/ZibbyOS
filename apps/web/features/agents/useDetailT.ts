import { useTranslations } from "next-intl";

/** `t(key, values)` over the `agents.detail` namespace. */
export type DetailT = (key: string, values?: Record<string, string | number>) => string;

/**
 * Translator for `agents.detail.*`. Typed loosely on purpose: these keys live in
 * `i18n/messages/pending/agent-detail.*.json` until the orchestrator merges them into the
 * main catalogs (which drive next-intl's key types). Tighten to `useTranslations("agents.detail")`
 * after the merge.
 */
export function useDetailT(): DetailT {
  return useTranslations("agents.detail" as never) as unknown as DetailT;
}
