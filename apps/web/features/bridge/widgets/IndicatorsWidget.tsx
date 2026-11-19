"use client";

import {
  BriefingHero,
  type BriefingHeroCounter,
  type SubNavLinkComponent,
} from "@zibby/design-system";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { use, useEffect, useMemo } from "react";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { useApprovalsQuery } from "../../approvals/queries";
import { runsListHref } from "../../archive/runsListFilters";
import { passesFilters } from "../../inbox/inbox";
import { useInboxPrsQuery } from "../../inbox/queries";
import { useBudgetQuery } from "../../projects/queries";
import { useLiveRuns } from "../../runs/components/TasksDockPanel";
import { REVIEW_PRESET } from "../grid/presets";
import { prCiState, prReviewState } from "../state/prStatus";
import { formatUsd, spendMonthUsd } from "../state/rows";
import { useBridgeInboxFilters } from "../state/useBridgeInboxFilters";
import { BridgePresetContext, PRS_PAGE_HREF } from "./BriefingWidget";
import type { BridgeWidgetProps } from "./registry";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Indicators: the big numerals the old briefing hero carried — NEEDS YOU (pending approvals),
 * RUNNING NOW (running runs), OPEN PRS (the PR widget's set), REVIEW ON YOU (others' PRs awaiting
 * my review), SPEND THIS MONTH. Every number links to its detail page. In REVIEW the counters are
 * the review set (on you, open, CI failing, conflict) and slim; on a phone they scroll sideways.
 * Never empty; reports no count.
 */
export function IndicatorsWidget({ onEmptyChange }: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.indicators");
  const filters = useBridgeInboxFilters();
  const preset = use(BridgePresetContext);
  const phone = useIsPhone();
  const { data: approvals } = useApprovalsQuery();
  const { data: prs } = useInboxPrsQuery();
  const { data: budget } = useBudgetQuery();
  // Only `running` — the bucket its `?state=running` link filters to, so the numbers match.
  const running = useLiveRuns().filter((r) => r.status === "running").length;
  const review = preset === REVIEW_PRESET && !phone;

  // Never empty (the counters always render).
  useEffect(() => onEmptyChange(false), [onEmptyChange]);

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

  return (
    <BriefingHero
      ariaLabel={t("label")}
      counters={counters}
      linkComponent={Link as SubNavLinkComponent}
      variant={phone ? "phone" : review ? "slim" : "full"}
    />
  );
}
