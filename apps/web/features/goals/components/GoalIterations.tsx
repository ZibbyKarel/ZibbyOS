"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  EmptyState,
  type IconName,
  type IterationRowTone,
  IterationTimeline,
  IterationTimelineItem,
  type IterationTimelineTone,
  SegmentedControl,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { GoalIteration, TaskRun } from "@zibby/contracts";
import { formatDuration, iterationDurationMs, runTotals, verdictLine } from "../goal";
import { GoalIterationLog } from "./GoalIterationLog";

export interface GoalIterationsProps {
  run: TaskRun | undefined;
  /** The goal's maker id — the maker row names it. */
  makerId: string;
  nowMs: number;
}

interface Verdict {
  icon: IconName;
  tone: IterationRowTone;
  textKey: "judging" | "passed" | "failed" | "paused" | "notRun";
}

function verdictOf(it: GoalIteration, parkedHere: boolean): Verdict {
  if (parkedHere) return { icon: "pause", tone: "neutral", textKey: "paused" };
  if (it.status === "running") return { icon: "dots", tone: "neutral", textKey: "judging" };
  if (it.status === "paused-limit") return { icon: "pause", tone: "neutral", textKey: "paused" };
  if (it.status === "failed" && !it.verifier.output)
    return { icon: "x", tone: "neutral", textKey: "notRun" };
  return it.verifier.satisfied
    ? { icon: "check", tone: "ok", textKey: "passed" }
    : { icon: "x", tone: "bad", textKey: "failed" };
}

function markerTone(it: GoalIteration, verdict: Verdict): IterationTimelineTone {
  if (verdict.textKey === "paused") return "paused";
  if (it.status === "running") return "run";
  return it.verifier.satisfied ? "ok" : "bad";
}

/** The iterations of one goal run — header totals, newest/oldest toggle, and the timeline. */
export function GoalIterations({ run, makerId, nowMs }: GoalIterationsProps) {
  const t = useTranslations("goalPage");
  const [newestFirst, setNewestFirst] = useState(true);
  const iterations = run?.iterations ?? [];
  // The running iteration opens by default so its live log is visible.
  const runningIndex = iterations.find((it) => it.status === "running")?.index ?? null;
  const [openState, setOpen] = useState<number | null | undefined>(undefined);
  const open = openState === undefined ? runningIndex : openState;
  const totals = run ? runTotals(run, nowMs) : undefined;
  const parkedIndex = run?.status === "parked" ? run.goalParked?.iteration : undefined;
  const ordered = newestFirst ? [...iterations].reverse() : iterations;

  const summary = totals
    ? [
        t("iterationCount", { n: totals.count }),
        formatDuration(totals.durationMs),
        ...(totals.costUsd !== undefined ? [`$${totals.costUsd.toFixed(2)}`] : []),
      ].join(" · ")
    : "";

  return (
    <Stack gap="100">
      <Stack wrap align="center" direction="row" gap="150">
        <Typography type="h3">{t("iterations")}</Typography>
        <Typography mono size="xs" type="note" variant="tertiary">
          {summary}
        </Typography>
        <Stack grow />
        <SegmentedControl
          ariaLabel={t("order")}
          items={[
            { value: "newest", label: t("newestFirst") },
            { value: "oldest", label: t("oldestFirst") },
          ]}
          onChange={(v) => setNewestFirst(v === "newest")}
          size="sm"
          value={newestFirst ? "newest" : "oldest"}
        />
      </Stack>
      {iterations.length === 0 ? (
        <EmptyState body={t("noIterationsBody")} title={t("noIterationsTitle")} />
      ) : (
        <IterationTimeline ariaLabel={t("iterations")}>
          {ordered.map((it) => {
            const verdict = verdictOf(it, parkedIndex === it.index);
            const isOpen = open === it.index;
            const hasLog = Boolean(it.makerRunRef || it.verifier.runRef || it.verifier.output);
            const failedMaker = it.status === "failed" && !it.verifier.output;
            return (
              <IterationTimelineItem
                expanded={isOpen}
                key={it.index}
                marker={it.index + 1}
                meta={<span>{formatDuration(iterationDurationMs(it, nowMs))}</span>}
                onToggle={hasLog ? () => setOpen(isOpen ? null : it.index) : undefined}
                rows={[
                  {
                    label: t("maker"),
                    icon: failedMaker ? "x" : it.status === "running" ? "dots" : "check",
                    tone: failedMaker ? "bad" : it.status === "running" ? "neutral" : "ok",
                    text: t(it.makerKind === "agent" ? "makerAgentRow" : "makerWorkflowRow", {
                      id: makerId,
                    }),
                  },
                  {
                    label: t("verifier"),
                    icon: verdict.icon,
                    tone: verdict.tone,
                    text: verdictLine(it.verifier.output) || t(`verdict.${verdict.textKey}`),
                  },
                ]}
                title={t("iterationN", { n: it.index + 1 })}
                toggleLabel={t(isOpen ? "hideLog" : "showLog", { n: it.index + 1 })}
                tone={markerTone(it, verdict)}
              >
                {isOpen ? <GoalIterationLog iteration={it} /> : null}
              </IterationTimelineItem>
            );
          })}
        </IterationTimeline>
      )}
    </Stack>
  );
}
