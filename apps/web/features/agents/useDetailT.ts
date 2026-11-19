import { useTranslations } from "next-intl";

/** `t(key, values)` over the `agents.detail` namespace; keys are often built dynamically, hence loosely typed. */
export type DetailT = (key: string, values?: Record<string, string | number>) => string;

export function useDetailT(): DetailT {
  return useTranslations("agents.detail" as never) as unknown as DetailT;
}
