"use client";

import {
  Avatar,
  BoardLead,
  BoardLine,
  BoardPill,
  type BoardPillTone,
  BoardRow,
  BoardText,
  Checkbox,
  Icon,
  IconBadge,
  IndentRail,
  Stack,
  StateGlyph,
  type StateGlyphTone,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode, useCallback, useMemo } from "react";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { useRefreshInboxMutation } from "../../inbox/mutations";
import { useInboxPrsQuery } from "../../inbox/queries";
import type { PrCiState } from "../state/prStatus";
import { type PrNodeVm, type PrRowVm, prTree } from "../state/rows";
import { useBridgeInboxFilters } from "../state/useBridgeInboxFilters";
import { CI_ICON, PrFilterControls } from "./PrFilterControls";
import type { BridgeWidgetProps, WidgetSettingsProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";
import {
  WidgetFilterBar,
  WidgetSortControl,
  WidgetSortSettings,
  useWidgetFilterPick,
  useWidgetSortPick,
} from "./widgetFilters";

export enum PrsWidgetTestId {
  Avatar = "prs-widget-avatar",
  Ci = "prs-widget-ci",
  Review = "prs-widget-review",
  Draft = "prs-widget-draft",
  Stack = "prs-widget-stack",
}

/** Stack levels drawn as indentation; deeper PRs line up with the last one. */
const MAX_INDENT = 3;

/** CI state -> the colour of its glyph (colour = state only). */
const CI_TONE: Record<PrCiState, StateGlyphTone> = {
  passing: "done",
  failing: "error",
  conflict: "blocked",
  running: "thinking",
  none: "idle",
};

/** Pill order: what needs me first, then errors, blocks, neutral info, done. */
const SEVERITY: Record<BoardPillTone, number> = {
  you: 0,
  error: 1,
  blocked: 2,
  neutral: 3,
  done: 4,
};
/** A row shows at most this many state pills. */
const MAX_PILLS = 2;

/** The review pill's colour: amber fill when the review waits for me. */
function reviewTone(r: PrRowVm): BoardPillTone {
  if (r.needsYou) return "you";
  if (r.review === "changes") return "blocked";
  if (r.review === "approved") return "done";
  return "neutral";
}

/** The PRs matching the pick as one flat list (tree order; greyed ancestor context dropped). */
const flat = (nodes: PrNodeVm[]): PrRowVm[] =>
  nodes.flatMap((n) => [...(n.row.muted ? [] : [n.row]), ...flat(n.kids)]);

/** The PRs stacked on top of this one, at any depth. */
const stackSize = (n: PrNodeVm): number => n.kids.reduce((sum, k) => sum + 1 + stackSize(k), 0);

export enum PrsWidgetSettingsTestId {
  ShowStacks = "prs-widget-settings-show-stacks",
}

/** PR widget settings: the list order plus whether stacked PRs are grouped (`widget.showStacks`). */
export function PrsWidgetSettings({ draft, onChange }: WidgetSettingsProps) {
  const t = useTranslations("bridge.settings");
  return (
    <>
      <WidgetSortSettings draft={draft} onChange={onChange} />
      <Stack align="center" direction="row" gap="100">
        <Checkbox
          checked={draft.showStacks !== false}
          data-testid={PrsWidgetSettingsTestId.ShowStacks}
          label={t("showStacks")}
          onChange={(showStacks) => onChange({ ...draft, showStacks })}
        />
        <Typography as="span" size="sm" type="note">
          {t("showStacks")}
        </Typography>
      </Stack>
    </>
  );
}

/**
 * Pull requests: the set the `/dashboard/inbox/pull-requests` screen lists (stored filters) as
 * one flat list ordered by the live sort (from `widget.sort`, default: last change, newest first), each stack kept together (base -> head, indented behind a rail).
 * The filter row above narrows by review / CI state, owner, company and requested review team and
 * doubles as the legend of the card icons.
 * No action buttons here; they live in the detail sheet.
 */
export function PrsWidget({
  widget,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
  sheetSide,
  filtersOpen,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.prs");
  const now = useNow(60_000);
  const filters = useBridgeInboxFilters();
  const refresh = useRefreshInboxMutation();
  const { mutate } = refresh;
  // A failed sync just re-enables the button; the previous data stays on screen.
  const onRefresh = useCallback(() => mutate(), [mutate]);
  const prsQuery = useInboxPrsQuery();
  const [pick, setPick, filtersChanged] = useWidgetFilterPick(widget.filters);
  // The order is part of the filter bar: a live pick from the saved `widget.sort`.
  const [sort, setSort, sortChanged] = useWidgetSortPick(widget.sort);

  const { nodes, counts, total, matched, you } = useMemo(
    () =>
      prTree(
        widget.id,
        prsQuery.data?.prs ?? [],
        filters,
        pick,
        (iso) => compactAgo(iso, now),
        sort,
      ),
    [widget.id, prsQuery.data, filters, pick, now, sort],
  );
  // The header counts only the PRs matching the picked filters; a pick that matches nothing must
  // still not collapse the widget (and its filter bar with it) — hence `failed` while total > 0.

  useWidgetReport(
    {
      onRefresh,
      refreshing: refresh.isPending,
      loading: prsQuery.isPending,
      count: prsQuery.isPending ? undefined : matched,
      you,
      failed: total > 0,
      filtersActive: filtersChanged || sortChanged,
    },
    { onEmptyChange, onCountChange },
  );

  const card = (r: PrRowVm, stack: number) => {
    const pills: { tone: BoardPillTone; node: ReactNode }[] = [
      {
        tone: reviewTone(r),
        node: (
          <BoardPill
            data-testid={PrsWidgetTestId.Review}
            key="review"
            title={t(`reviewHint.${r.reviewHint}`)}
            tone={reviewTone(r)}
          >
            {r.needsYou ? t("pill.you") : t(`pill.${r.review}`)}
          </BoardPill>
        ),
      },
    ];
    if (r.draft)
      pills.push({
        tone: "neutral",
        node: (
          <BoardPill data-testid={PrsWidgetTestId.Draft} key="draft" tone="neutral">
            {t("pill.draft")}
          </BoardPill>
        ),
      });
    pills.sort((a, b) => SEVERITY[a.tone] - SEVERITY[b.tone]);
    return (
      <BoardRow
        key={r.key}
        muted={r.muted}
        onClick={() => onOpen({ kind: "pr", id: r.id, widgetId: widget.id, key: r.key })}
        rowKey={r.key}
        selected={selection?.key === r.key}
        shape="list"
        sheetSide={sheetSide}
        tone={r.tone}
        trailing={
          <BoardLine gap="6">
            {r.conversations > 0 ? (
              <IconBadge
                count={r.conversations}
                icon="chat"
                label={t("conversations", { count: r.conversations })}
              />
            ) : null}
            {pills.slice(0, MAX_PILLS).map((p) => p.node)}
          </BoardLine>
        }
      >
        <BoardLead
          lead={
            <StateGlyph
              data-testid={PrsWidgetTestId.Ci}
              icon={CI_ICON[r.ci].name}
              label={t(`ci.${r.ci}`)}
              spin={r.ci === "running"}
              tone={CI_TONE[r.ci]}
            />
          }
        >
          <BoardLine baseline gap="8">
            <BoardText kind="rowId">{r.number}</BoardText>
            <BoardText truncate kind="rowTitle" title={r.title}>
              {r.title}
            </BoardText>
          </BoardLine>
          {/* Not wrapped: when the line runs out of room the repo clips first, then the name. */}
          <BoardLine gap="6">
            <Avatar
              aria-label={r.author}
              data-testid={PrsWidgetTestId.Avatar}
              name={r.author}
              role="img"
              size="xs"
              src={r.avatarUrl}
              title={r.author}
            />
            <BoardText kind="rowMeta">{r.author}</BoardText>
            {/* Dots are their own items so the line gap spaces them evenly on both sides. */}
            <BoardText kind="rowMeta">·</BoardText>
            <BoardText truncate kind="rowMeta">
              {r.project}
            </BoardText>
            <BoardText kind="rowMeta">·</BoardText>
            <BoardText kind="rowId">{r.age}</BoardText>
            {stack > 0 ? (
              <>
                <Icon name="stack" size="xs" tone="faint" />
                <BoardText data-testid={PrsWidgetTestId.Stack} kind="rowMeta">
                  {t("stack", { count: stack + 1 })}
                </BoardText>
              </>
            ) : null}
          </BoardLine>
        </BoardLead>
      </BoardRow>
    );
  };

  const tree = (n: PrNodeVm, depth: number): ReactNode => {
    const kids = n.kids.map((k) => tree(k, depth + 1));
    return (
      <Fragment key={n.row.key}>
        {card(n.row, depth === 0 ? stackSize(n) : 0)}
        {kids.length === 0 ? null : depth < MAX_INDENT ? (
          <IndentRail variant="stack">{kids}</IndentRail>
        ) : (
          kids
        )}
      </Fragment>
    );
  };

  return (
    <>
      <WidgetFilterBar open={filtersOpen}>
        <WidgetSortControl onChange={setSort} value={sort} />
        <PrFilterControls counts={counts} onChange={setPick} pick={pick} />
      </WidgetFilterBar>
      {widget.showStacks === false
        ? flat(nodes).map((r) => <Fragment key={r.key}>{card(r, 0)}</Fragment>)
        : nodes.map((n) => tree(n, 0))}
    </>
  );
}
