"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget } from "@zibby/contracts";
import type { StateTone } from "@zibby/design-system";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import {
  useInvalidateOnTerminalRun,
  useLiveRunsSnapshot,
} from "../../runs/components/TasksDockPanel";
import { useRecentArchivedRunsQuery } from "../../runs/queries/useRecentArchivedRunsQuery";
import { useRunsQuery } from "../../runs/queries/useRunsQuery";
import type { RunView } from "../../runs/run";
import { runRows } from "../../bridge/state/rows";
import { ChatWidgetFrame, ChatWidgetRow, takeRows, widgetStatus } from "./ChatWidgetFrame";

export enum RunsWidgetCardTestId {
  Root = "runs-widget-card",
}

export interface RunsWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "runs" }>;
}

/** Same window the dashboard's Runs widget reads (shares its cache entry). */
const ARCHIVE_LIMIT = 10;

/** Live runs first (they are what the operator asks about), then the newest finished ones. */
export function mergeRuns(live: RunView[], archived: RunView[], projectId?: string): RunView[] {
  const liveIds = new Set(live.map((r) => r.runId));
  const all = [...live, ...archived.filter((r) => !liveIds.has(r.runId))];
  return projectId ? all.filter((r) => r.projectId === projectId) : all;
}

const LIVE_TONES: ReadonlySet<StateTone> = new Set(["working", "thinking"]);

/**
 * `runs` — recent and active runs: state dot + word, title, target · project, age; the
 * row leads to the run detail. Data: the same live feed (`useRunsQuery`) + recent archive
 * (`useRecentArchivedRunsQuery`) the dashboard Runs widget uses, rows via `runRows`.
 */
export function RunsWidgetCard({ widget }: RunsWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tRuns = useTranslations("runs");
  const now = useNow(60_000);
  const feed = useRunsQuery();
  const live = useLiveRunsSnapshot();
  useInvalidateOnTerminalRun(ARCHIVE_LIMIT);
  const archived = useRecentArchivedRunsQuery(ARCHIVE_LIMIT);

  const runs = useMemo(
    () => mergeRuns(live.runs, archived.data ?? [], widget.projectId),
    [live.runs, archived.data, widget.projectId],
  );
  const rows = useMemo(() => runRows("zibby", runs), [runs]);
  const { shown, hiddenCount } = takeRows(rows, widget.limit);
  const byId = new Map(runs.map((r) => [r.runId, r]));

  return (
    <ChatWidgetFrame
      count={rows.length}
      emptyText={t("runs.empty")}
      hiddenCount={hiddenCount}
      onRetry={() => void feed.refetch()}
      openHref="/activity/runs"
      rootTestId={RunsWidgetCardTestId.Root}
      status={widgetStatus({
        isPending: feed.isPending && archived.isPending,
        isError: feed.isError && archived.isError,
        count: rows.length,
      })}
      title={widget.title ?? t("runs.title")}
    >
      {shown.map((r) => {
        const run = byId.get(r.runId);
        const startedAt = run?.taskOutcomeFinishedAt ?? r.startedAt;
        return (
          <ChatWidgetRow
            dim={r.tone === "done" || r.tone === "idle"}
            href={`/activity/runs/${r.runId}`}
            itemKey={r.runId}
            key={r.runId}
            linkLabel={t("runs.openAria", { title: r.title })}
            meta={[r.step, r.project, compactAgo(startedAt, now)].filter(Boolean).join(" · ")}
            pulse={LIVE_TONES.has(r.tone)}
            statusLabel={tRuns(`state.${r.status}`)}
            title={r.title}
            tone={r.tone}
          />
        );
      })}
    </ChatWidgetFrame>
  );
}
