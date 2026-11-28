"use client";

import type { AutomationView } from "@zibby/contracts";
import {
  BoardSection,
  Icon,
  Stack,
  type StateTone,
  StatusRailItem,
  TimelineAxis,
  type TimelinePoint,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";
import { useNow } from "../../../hooks/useNow";
import { useAutomationsQuery } from "../../automations/queries";
import { SCHEDULE_TIME_ZONE, nextCronRun, relativeLabel } from "../../automations/schedule";
import { useCronLabel } from "../../automations/useCronLabel";
import { useLiveRuns } from "../../runs/components/TasksDockPanel";
import { useRunsQuery } from "../../runs/queries/useRunsQuery";
import type { RunView } from "../../runs/run";
import { runRows } from "../state/rows";
import type { BridgeWidgetProps } from "./registry";
import { RunElapsed } from "./RunsWidget";
import { useWidgetReport } from "./useWidgetReport";

export enum AutomationRunsWidgetTestId {
  /** The row's 24h time cell — suffixed `-<row key>`. */
  Time = "automation-runs-widget-time",
  /** The failed marker on an upcoming or failed row (todo-5) — suffixed `-<row key>`. */
  Failed = "automation-runs-widget-failed",
  /** The system (shield) / user icon left of the title (todo-7) — suffixed `-<row key>`. */
  Kind = "automation-runs-widget-kind",
}

/** todo-7: shield for a system automation, user for a user one — neutral ink (colour = state only). */
function AutomationTitle({ rowKey, automation }: { rowKey: string; automation: AutomationView }) {
  const t = useTranslations("bridge.widgets.automationRuns.kind");
  const label = t(automation.system ? "system" : "user");
  return (
    <>
      {/* Inline: `Icon` is a block, so a plain span would wrap the title onto a second line. */}
      <Stack
        inline
        aria-label={label}
        as="span"
        data-kind={automation.system ? "system" : "user"}
        data-testid={`${AutomationRunsWidgetTestId.Kind}-${rowKey}`}
        role="img"
        title={label}
      >
        <Icon name={automation.system ? "shield" : "user"} size="xs" tone="faint" />
      </Stack>{" "}
      {automation.name ?? automation.id}
    </>
  );
}

/** Clock hours labelled under the 24 h axis. */
const TICK_HOURS = [0, 6, 12, 18];
/** ponytail: caps the diamonds per automation (an every-minute cron would draw 1440); raise if needed. */
const MAX_SLOTS = 96;

/** Every fire of `expr` within the next `HORIZON_MINUTES`, as epoch ms. */
function cronSlots(expr: string, now: number): number[] {
  const out: number[] = [];
  let from = new Date(now);
  while (out.length < MAX_SLOTS) {
    const left = HORIZON_MINUTES - Math.ceil((from.getTime() - now) / 60_000);
    const next = left > 0 ? nextCronRun(expr, from, left) : null;
    if (!next) break;
    out.push(next.getTime());
    from = next;
  }
  return out;
}

/** How far ahead "upcoming" looks — also bounds the minute-by-minute cron scan. */
const HORIZON_MINUTES = 24 * 60;
/** How long a failed fire keeps marking its automation (todo-5). */
const FAILED_WINDOW_MS = 24 * 60 * 60_000;

export type AutomationRowState =
  | { kind: "running"; startedAt: string }
  | { kind: "failed"; at: string }
  | { kind: "idle" };

/**
 * todo-5: what an automation's row shows. Running = a live run it fired, or its in-process
 * fire still running. Failed = its latest fire errored within 24 h, or its latest run
 * errored within 24 h and no newer fire followed that run. Else idle (the countdown).
 */
export function automationRowState(
  a: AutomationView,
  liveRun: RunView | undefined,
  latestRun: RunView | undefined,
  now: number,
): AutomationRowState {
  if (liveRun) return { kind: "running", startedAt: liveRun.startedAt };
  const fire = a.lastFire;
  if (fire?.status === "running") return { kind: "running", startedAt: fire.startedAt };
  const recent = (at: string) => now - Date.parse(at) <= FAILED_WINDOW_MS;
  if (fire?.status === "error" && fire.finishedAt && recent(fire.finishedAt)) {
    return { kind: "failed", at: fire.finishedAt };
  }
  if (latestRun?.status === "error") {
    const at = latestRun.taskOutcomeFinishedAt ?? latestRun.startedAt;
    const fireIsThisRunOrOlder =
      !fire ||
      fire.runRef === latestRun.runId ||
      Date.parse(fire.startedAt) <= Date.parse(latestRun.startedAt);
    if (fireIsThisRunOrOlder && recent(at)) return { kind: "failed", at };
  }
  return { kind: "idle" };
}

/**
 * Automation runs — timeline species. A 24 h axis from now (clock ticks 00/06/12/18, a diamond per
 * cron start; rose when the automation failed in the last 24 h), then the live runs an automation
 * fired and its in-process fires still running, then each other enabled cron automation's next
 * fire within 24 h, soonest first — one that failed in the last 24 h shows "Failed <ago>" next to
 * the countdown (todo-5). Times are 24h (Europe/Prague, the scheduler's zone). Header aside: the
 * next start. Every row opens the automation sheet (detail + run now).
 */
export function AutomationRunsWidget({
  widget,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.automationRuns");
  const locale = useLocale();
  const cronLabel = useCronLabel();
  const now = useNow(60_000);
  const live = useLiveRuns();
  const { runs: allRuns } = useRunsQuery();
  const { data: automations, isPending } = useAutomationsQuery();
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const hhmm = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: SCHEDULE_TIME_ZONE,
      }),
    [locale],
  );
  const byId = useMemo(() => new Map((automations ?? []).map((a) => [a.id, a])), [automations]);

  const running = useMemo(() => {
    // A parked run (exhausted retries) is waiting on the operator, not running.
    const runs = live.filter((r) => r.automationId && r.status !== "parked");
    return runRows(widget.id, runs).map((row, i) => ({
      ...row,
      automationId: runs[i]?.automationId ?? "",
    }));
  }, [widget.id, live]);

  // In-process fires still running (a run-backed fire shows as its live run above).
  const firing = useMemo(
    () =>
      (automations ?? []).flatMap((a) => {
        const startedAt = a.lastFire?.status === "running" ? a.lastFire.startedAt : undefined;
        if (!startedAt || running.some((r) => r.automationId === a.id)) return [];
        return [{ key: `${widget.id}:fire:${a.id}`, automation: a, startedAt }];
      }),
    [widget.id, automations, running],
  );

  const latestRunOf = useMemo(() => {
    const latest = new Map<string, RunView>();
    for (const r of allRuns) {
      if (!r.automationId) continue;
      const prev = latest.get(r.automationId);
      if (!prev || r.startedAt > prev.startedAt) latest.set(r.automationId, r);
    }
    return latest;
  }, [allRuns]);

  // One pass: an enabled cron automation with a slot in the next 24 h is upcoming (marked when
  // it failed); any other automation that failed in the last 24 h (event/signal trigger,
  // disabled, no slot soon) gets a failed row in the running group (todo-5).
  const { upcoming, failed } = useMemo(() => {
    const busy = new Set([
      ...running.map((r) => r.automationId),
      ...firing.map((f) => f.automation.id),
    ]);
    const upcoming: {
      key: string;
      automation: AutomationView;
      expr: string;
      at: number;
      failedAt?: number;
    }[] = [];
    const failed: { key: string; automation: AutomationView; at: number }[] = [];
    for (const a of automations ?? []) {
      if (busy.has(a.id)) continue;
      const state = automationRowState(a, undefined, latestRunOf.get(a.id), now);
      const failedAt = state.kind === "failed" ? Date.parse(state.at) : undefined;
      const expr = a.enabled && a.trigger.type === "cron" ? a.trigger.expr : undefined;
      const at = expr ? nextCronRun(expr, new Date(now), HORIZON_MINUTES)?.getTime() : undefined;
      if (expr && at !== undefined) {
        upcoming.push({ key: `${widget.id}:next:${a.id}`, automation: a, expr, at, failedAt });
      } else if (failedAt !== undefined) {
        failed.push({ key: `${widget.id}:failed:${a.id}`, automation: a, at: failedAt });
      }
    }
    return { upcoming: upcoming.sort((x, y) => x.at - y.at), failed };
  }, [widget.id, automations, now, running, firing, latestRunOf]);

  const axis = useMemo(() => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: SCHEDULE_TIME_ZONE,
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    const cur = Number(parts.hour) * 60 + Number(parts.minute);
    const ticks: TimelinePoint[] = TICK_HOURS.map((h) => ({
      at: ((((h * 60 - cur) % 1440) + 1440) % 1440) / 1440,
      label: String(h).padStart(2, "0"),
    }));
    const markers: TimelinePoint[] = (automations ?? []).flatMap((a) => {
      if (!a.enabled || a.trigger.type !== "cron") return [];
      const failed = automationRowState(a, undefined, latestRunOf.get(a.id), now).kind === "failed";
      return cronSlots(a.trigger.expr, now).map((at) => ({
        at: (at - now) / (HORIZON_MINUTES * 60_000),
        label: `${hhmm.format(at)} · ${a.name ?? a.id}`,
        error: failed,
      }));
    });
    return { ticks, markers };
  }, [automations, latestRunOf, now, hhmm]);

  useWidgetReport(
    {
      loading: isPending,
      count: isPending
        ? undefined
        : running.length + firing.length + failed.length + upcoming.length,
      you: 0,
      aside: upcoming[0]
        ? t("next", { in: relativeLabel(upcoming[0].at, now, locale) })
        : undefined,
    },
    { onEmptyChange, onCountChange },
  );

  if (running.length + firing.length + failed.length + upcoming.length === 0) return null;

  const open = (id: string, key: string) => () =>
    onOpen({ kind: "automation", id, widgetId: widget.id, key, href: `/work/automations/${id}` });
  const header = (group: "running" | "upcoming", count: number) =>
    count === 0 ? null : (
      <BoardSection
        closed={!!closed[group]}
        count={String(count).padStart(2, "0")}
        label={t(`group.${group}`)}
        onToggle={() => setClosed((c) => ({ ...c, [group]: !c[group] }))}
      />
    );
  const time = (key: string, at: number) => (
    <span data-testid={`${AutomationRunsWidgetTestId.Time}-${key}`}>{hhmm.format(at)}</span>
  );
  const failedNote = (key: string, at: number) => (
    <span data-testid={`${AutomationRunsWidgetTestId.Failed}-${key}`}>
      {t("failed", { ago: relativeLabel(at, now, locale) })}
    </span>
  );
  const row = (
    key: string,
    automationId: string,
    tone: StateTone,
    title: ReactNode,
    sub: ReactNode,
    at: number,
  ) => (
    <StatusRailItem
      key={key}
      onClick={open(automationId, key)}
      rowKey={key}
      selected={selection?.key === key}
      sub={sub}
      time={time(key, at)}
      title={title}
      tone={tone}
    />
  );

  return (
    <>
      <TimelineAxis
        label={t("axis", { count: axis.markers.length })}
        markers={axis.markers}
        ticks={axis.ticks}
      />
      {header("running", running.length + firing.length + failed.length)}
      {!closed["running"] &&
        running.map((r) => {
          const a = byId.get(r.automationId);
          return row(
            r.key,
            r.automationId,
            r.tone,
            a ? <AutomationTitle automation={a} rowKey={r.key} /> : r.title,
            <>
              {r.step} · <RunElapsed startedAt={r.startedAt} />
            </>,
            Date.parse(r.startedAt),
          );
        })}
      {!closed["running"] &&
        firing.map((f) =>
          row(
            f.key,
            f.automation.id,
            "working",
            <AutomationTitle automation={f.automation} rowKey={f.key} />,
            <>
              {f.automation.target.type} · <RunElapsed startedAt={f.startedAt} />
            </>,
            Date.parse(f.startedAt),
          ),
        )}
      {!closed["running"] &&
        failed.map((f) =>
          row(
            f.key,
            f.automation.id,
            "error",
            <AutomationTitle automation={f.automation} rowKey={f.key} />,
            <>
              {f.automation.target.type} · {failedNote(f.key, f.at)}
            </>,
            f.at,
          ),
        )}
      {header("upcoming", upcoming.length)}
      {!closed["upcoming"] &&
        upcoming.map((u) =>
          row(
            u.key,
            u.automation.id,
            u.failedAt === undefined ? "idle" : "error",
            <AutomationTitle automation={u.automation} rowKey={u.key} />,
            <>
              {cronLabel(u.expr)} · {relativeLabel(u.at, now, locale)}
              {u.failedAt !== undefined && <> · {failedNote(u.key, u.failedAt)}</>}
            </>,
            u.at,
          ),
        )}
    </>
  );
}
