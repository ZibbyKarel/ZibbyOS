"use client";

import {
  type SubNavLinkComponent,
  TextLink,
  UsagePanel,
  type UsagePanelItem,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import Link from "next/link";

export enum HeaderLimitsTestId {
  Trigger = "header-limits-trigger",
}

export interface HeaderLimitsProps {
  items: readonly UsagePanelItem[];
}

const BUDGETS_HREF = "/governance/budgets";

/** The top bar's limits: the `UsagePanel` rings as a plain link to Budgets & limits. */
export function HeaderLimits({ items }: HeaderLimitsProps) {
  const t = useTranslations();
  return (
    <TextLink
      aria-label={t("bridge.widget.budgets.label")}
      data-testid={HeaderLimitsTestId.Trigger}
      href={BUDGETS_HREF}
      linkComponent={Link as SubNavLinkComponent}
    >
      <UsagePanel items={items} />
    </TextLink>
  );
}
