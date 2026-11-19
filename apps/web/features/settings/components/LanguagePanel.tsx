"use client";

import { SegmentedControl, SettingsPanel, SettingsRow } from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSettingsReadOnly } from "../draft/SettingsDraftProvider";

type Locale = "cs" | "en";

export enum LanguagePanelTestId {
  Locale = "settings-language-locale",
}

/** Module-scoped so the cookie write isn't analyzed as an in-render mutation. */
function writeLocaleCookie(value: Locale) {
  document.cookie = `locale=${value}; path=/; max-age=31536000`;
}

/** General → Language: the interface locale (cookie, applied instantly). */
export function LanguagePanel() {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const readOnly = useSettingsReadOnly();
  return (
    <SettingsPanel
      description={t("languagePanel.hint")}
      id="language"
      title={t("languagePanel.title")}
    >
      <SettingsRow hint={t("languagePanel.rowHint")} label={t("languagePanel.interface")}>
        <div data-testid={LanguagePanelTestId.Locale}>
          <SegmentedControl
            ariaLabel={t("language")}
            items={[
              { value: "cs", label: "Čeština", disabled: readOnly },
              { value: "en", label: "English", disabled: readOnly },
            ]}
            onChange={(v) => {
              writeLocaleCookie(v as Locale);
              router.refresh();
            }}
            value={locale}
          />
        </div>
      </SettingsRow>
    </SettingsPanel>
  );
}
