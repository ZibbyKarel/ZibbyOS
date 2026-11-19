"use client";

import { BriefingHero, Markdown, type SubNavLinkComponent } from "@zibby/design-system";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useCallback, useEffect } from "react";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { useNow } from "../../../hooks/useNow";
import { useRefreshDayOverviewMutation } from "../../briefing/mutations";
import { useBriefingQuery, useDayOverviewQuery } from "../../briefing/queries";
import type { BridgeWidgetProps } from "./registry";

/** The pull-request table the PR numbers open (todo-18). */
export const PRS_PAGE_HREF = "/activity/pull-requests";

/** The active layout name — the board provides it so the hero can turn slim in REVIEW. */
export const BridgePresetContext = createContext<string>("DEFAULT");

/** Greeting by the hour of `now` (5–11 morning, 11–18 afternoon, else evening). */
function greetingKey(now: number): "morning" | "afternoon" | "evening" {
  const h = new Date(now).getHours();
  return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 18 ? "afternoon" : "evening";
}

/**
 * Today ("Dnešek", widget type `briefing`) as the T0 hero (spec §2/§4): greeting plus the day's
 * written overview — today's model-written text (links to runs / PRs / issues in amber) or, without
 * it, the current briefing's headline; no headline → "A quiet day.". The numerals live in the
 * Indicators widget. The text scrolls when the widget is small. Never empty; reports no count.
 */
export function BriefingWidget({ onEmptyChange, onCountChange }: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.briefing");
  const locale = useLocale();
  const phone = useIsPhone();
  const { data: briefing } = useBriefingQuery();
  const { data: day } = useDayOverviewQuery();
  const { mutate: refreshDay, isPending: refreshing } = useRefreshDayOverviewMutation();
  const now = useNow(60_000);

  const onRefresh = useCallback(() => refreshDay({ body: {} }), [refreshDay]);

  // Never empty; no count / YOU / aside in the header — only the sync button, which rewrites today's text.
  useEffect(() => {
    onEmptyChange(false);
    onCountChange?.({ onRefresh, refreshing });
  }, [onEmptyChange, onCountChange, onRefresh, refreshing]);

  const headline = briefing?.headline;
  // Today's model-written text wins over the one-line headline when it exists.
  const lead = day?.markdown ? (
    <Markdown escapeHtml source={day.markdown} variant="prose" />
  ) : (
    headline
  );
  const hasLead = Boolean(day?.markdown || headline);
  const at = new Date(briefing?.generatedAt ?? now);
  const eyebrow = t("kicker", {
    date: at.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
    time: at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  });
  return (
    <BriefingHero
      ariaLabel={t("label")}
      eyebrow={hasLead ? eyebrow : undefined}
      lead={lead}
      linkComponent={Link as SubNavLinkComponent}
      title={hasLead ? t(`greeting.${greetingKey(now)}`) : t("calm")}
      variant={phone ? "phone" : "full"}
    />
  );
}
