"use client";

import { Icon, Kbd, Row, SubNav, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { SETTINGS_PAGE_KEY, SETTINGS_SECTIONS } from "../settingsSections";

export enum SettingsCrumbBarTestId {
  Hint = "settings-crumb-hint",
}

/** Settings routes' row-2 chrome (mockup): "Settings › Page" plus the save hint, no tab strip. */
export function SettingsCrumbBar() {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const phone = useIsPhone();
  const section = SETTINGS_SECTIONS.find((s) => pathname.startsWith(`/system/settings/${s}`));
  return (
    <SubNav
      actions={
        phone ? undefined : (
          <Row gap="75">
            <Typography data-testid={SettingsCrumbBarTestId.Hint} size="xs" type="note">
              {t("crumb.hint")}
            </Typography>
            <Kbd>⌘S</Kbd>
          </Row>
        )
      }
      items={[]}
      trail={
        <Row aria-label={t("railTitle")} as="nav" gap="75">
          <Icon name="gear" size="sm" />
          <Link href="/system/settings/general">
            <Typography size="sm" type="text" variant="tertiary">
              {t("railTitle")}
            </Typography>
          </Link>
          {section && (
            <>
              <Typography aria-hidden="true" size="sm" type="text" variant="tertiary">
                ›
              </Typography>
              <Typography aria-current="page" size="sm" type="text" weight="medium">
                {t(`pages.${SETTINGS_PAGE_KEY[section]}.title` as never)}
              </Typography>
            </>
          )}
        </Row>
      }
    />
  );
}
