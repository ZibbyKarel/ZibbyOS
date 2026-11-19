"use client";

import {
  BriefingHero,
  type BriefingHeroCounter,
  Markdown,
  type SubNavLinkComponent,
} from "@zibby/design-system";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createContext, use, useCallback, useEffect, useMemo } from "react";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { useNow } from "../../../hooks/useNow";
import { useApprovalsQuery } from "../../approvals/queries";
import { useRefreshDayOverviewMutation } from "../../briefing/mutations";
import { useBriefingQuery, useDayOverviewQuery } from "../../briefing/queries";
import { useInboxPrsQuery } from "../../inbox/queries";
import { useBudgetQuery } from "../../projects/queries";
import { passesFilters } from "../../inbox/inbox";
import { useLiveRuns } from "../../runs/components/TasksDockPanel";
import { runsListHref } from "../../archive/runsListFilters";
import { REVIEW_PRESET } from "../grid/presets";
import { prCiState, prReviewState } from "../state/prStatus";
import { formatUsd, spendMonthUsd } from "../state/rows";
import { useBridgeInboxFilters } from "../state/useBridgeInboxFilters";
import type { BridgeWidgetProps } from "./registry";

const pad2 = (n: number) => String(n).padStart(2, "0");

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
 * Briefing as the T0 hero (spec §2/§4): greeting, the current briefing's headline as one
 paragraph (today's model-written overview when available), and big numerals — NEEDS YOU (pending approvals), RUNNING NOW (running runs),
 * OPEN PRS (the PR widget's set), REVIEW ON YOU (others' PRs awaiting my review), SPEND THIS
 * MONTH. Every number links to its detail page (todo-18). No headline → "A quiet day." +
 * numerals only. In REVIEW the hero is slim with review counters (on you, open, CI failing,
 * conflict); on a phone the counters scroll sideways. Never empty; reports no count.
 */
export function BriefingWidget({ onEmptyChange, onCountChange }: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.briefing");
  const locale = useLocale();
  const filters = useBridgeInboxFilters();
  const preset = use(BridgePresetContext);
  const phone = useIsPhone();
  const { data: briefing } = useBriefingQuery();
  const { data: day } = useDayOverviewQuery();
  const { mutate: refreshDay, isPending: refreshing } = useRefreshDayOverviewMutation();
  const { data: approvals } = useApprovalsQuery();
  const { data: prs } = useInboxPrsQuery();
  const { data: budget } = useBudgetQuery();
  // Only `running` — the bucket its `?state=running` link filters to, so the numbers match.
  const running = useLiveRuns().filter((r) => r.status === "running").length;
  const now = useNow(60_000);
  const review = preset === REVIEW_PRESET && !phone;

  const onRefresh = useCallback(() => refreshDay({ body: {} }), [refreshDay]);

  // Never empty (the counters always render); no count / YOU / aside in the header — only the
  // sync button, which rewrites today's text.
  useEffect(() => {
    onEmptyChange(false);
    onCountChange?.({ onRefresh, refreshing });
  }, [onEmptyChange, onCountChange, onRefresh, refreshing]);

  const counters = useMemo<BriefingHeroCounter[]>(() => {
    const open = (prs?.prs ?? []).filter((p) => passesFilters(filters, p));
    const onYou = open.filter((p) => p.bucket !== "mine" && prReviewState(p) === "review").length;
    const ci = (state: string) => open.filter((p) => prCiState(p) === state).length;
    const pr = (
      id: "prs" | "onYou" | "failing" | "conflict",
      n: number,
      tone?: BriefingHeroCounter["tone"],
    ) => ({
      id,
      label: t(id),
      value: pad2(n),
      tone: n > 0 ? tone : "dim",
      href: PRS_PAGE_HREF,
    });
    if (review)
      return [
        pr("onYou", onYou, "accent"),
        pr("prs", open.length),
        pr("failing", ci("failing"), "error"),
        pr("conflict", ci("conflict")),
      ];
    const needs = approvals?.length ?? 0;
    return [
      {
        id: "needs",
        label: t("needs"),
        value: pad2(needs),
        tone: needs > 0 ? "accent" : "dim",
        href: "/activity/approvals",
      },
      {
        id: "running",
        label: t("running"),
        value: pad2(running),
        tone: running > 0 ? undefined : "dim",
        href: runsListHref({ state: "running" }),
      },
      pr("prs", open.length),
      pr("onYou", onYou, "accent"),
      {
        id: "spend",
        label: t("spend"),
        value: formatUsd(spendMonthUsd(budget)),
        href: "/governance/budgets",
      },
    ];
  }, [t, review, approvals, running, prs, filters, budget]);

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
      counters={counters}
      eyebrow={hasLead ? eyebrow : undefined}
      lead={review ? undefined : lead}
      linkComponent={Link as SubNavLinkComponent}
      title={
        review ? headline || t("calm") : hasLead ? t(`greeting.${greetingKey(now)}`) : t("calm")
      }
      variant={phone ? "phone" : review ? "slim" : "full"}
    />
  );
}
