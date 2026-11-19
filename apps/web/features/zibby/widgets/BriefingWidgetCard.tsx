"use client";

import { useTranslations } from "next-intl";
import type { ChatWidget } from "@zibby/contracts";
import { Container, Divider, Stack, StatusDot, Typography } from "@zibby/design-system";
import { useBriefingQuery } from "../../briefing/queries";
import { NeedsYouRow } from "../../briefing/components/BriefingRows";
import { ChatWidgetFrame } from "./ChatWidgetFrame";

export enum BriefingWidgetCardTestId {
  Root = "briefing-widget-card",
  Headline = "briefing-widget-headline",
  NeedsYou = "briefing-widget-needs-you",
  MoreNeedsYou = "briefing-widget-more-needs-you",
  Counters = "briefing-widget-counters",
}

export interface BriefingWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "briefing" }>;
}

/** How many "needs you" rows the condensed card lists. */
const NEEDS_YOU_ROWS = 3;

/**
 * `briefing` — the latest briefing, condensed: headline, the first "needs you" rows
 * (the same {@link NeedsYouRow} the transcript briefing card and the page use) and the
 * did / watching counters. Data: `useBriefingQuery` (`GET /api/briefing`, a pure assembly).
 * The header link opens the full briefings page.
 */
export function BriefingWidgetCard({ widget }: BriefingWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tOverview = useTranslations("overview");
  const query = useBriefingQuery();
  const briefing = query.data;

  const status = query.isError
    ? "error"
    : query.isPending
      ? "loading"
      : briefing
        ? "ready"
        : "empty";
  const needs = briefing?.needsYou ?? [];
  const watching = briefing?.watching.filter((w) => w.integrationId).length ?? 0;

  return (
    <ChatWidgetFrame
      emptyText={t("briefing.empty")}
      onRetry={() => void query.refetch()}
      rootTestId={BriefingWidgetCardTestId.Root}
      status={status}
      title={widget.title ?? t("briefing.title")}
    >
      {briefing && (
        <Container padding={["100", "150"]}>
          <Stack direction="col" gap="100">
            <Stack align="start" direction="row" gap="100">
              <StatusDot size="75" tone={briefing.nothingNeedsYou ? "done" : "wait"} />
              <Typography
                data-testid={BriefingWidgetCardTestId.Headline}
                size="sm"
                type="note"
                weight="medium"
              >
                {briefing.headline || t("briefing.calm")}
              </Typography>
            </Stack>

            {needs.length > 0 && (
              <Stack data-testid={BriefingWidgetCardTestId.NeedsYou} direction="col" gap="75">
                <Typography size="xs" type="note" variant="tertiary">
                  {t("briefing.needsYou")}
                </Typography>
                {needs.slice(0, NEEDS_YOU_ROWS).map((item) => (
                  <NeedsYouRow item={item} key={item.id} />
                ))}
                {needs.length > NEEDS_YOU_ROWS && (
                  <Typography
                    data-testid={BriefingWidgetCardTestId.MoreNeedsYou}
                    size="xs"
                    type="note"
                    variant="tertiary"
                  >
                    {t("briefing.moreNeedsYou", { count: needs.length - NEEDS_YOU_ROWS })}
                  </Typography>
                )}
              </Stack>
            )}

            <Divider />
            <Stack
              wrap
              align="center"
              data-testid={BriefingWidgetCardTestId.Counters}
              direction="row"
              gap="200"
            >
              <Typography mono size="xs" type="note" variant="tertiary">
                {tOverview("briefingDid", { count: briefing.didForYou.length })}
              </Typography>
              {watching > 0 && (
                <Typography mono size="xs" type="note" variant="tertiary">
                  {tOverview("briefingWatching", { count: watching })}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Container>
      )}
    </ChatWidgetFrame>
  );
}
