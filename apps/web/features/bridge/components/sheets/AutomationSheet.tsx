"use client";

import { type Automation, automationTakesPrompt } from "@zibby/contracts";
import {
  AnchoredSheet,
  SheetAction,
  SheetBlock,
  SheetSection,
  SheetText,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useTriggerAutomationMutation } from "../../../automations/mutations";
import { useAutomationsQuery } from "../../../automations/queries";
import { useCronLabel } from "../../../automations/useCronLabel";
import { SCHEDULE_TIME_ZONE, nextCronRun } from "../../../automations/schedule";
import { AutomationFireLog } from "../../../automations/components/AutomationFireLog";
import { RunAutomationDialog } from "../../../automations/components/RunAutomationDialog";
import { AutomationFireStatus } from "../../../automations/components/AutomationFires";
import { formatDuration } from "../../../../utils/time";
import { type SheetProps, geometry } from "./sheetTypes";

export enum AutomationSheetTestId {
  Schedule = "automation-sheet-schedule",
  Prompt = "automation-sheet-prompt",
  RunNow = "automation-sheet-run-now",
  /** The latest fire's summary line (status · start · duration) — todo-5. */
  LastFire = "automation-sheet-last-fire",
  /** The next seven fires of a cron schedule. */
  NextRuns = "automation-sheet-next-runs",
}

/** The next `count` fires of a cron expression after `from` (a month ahead at most). */
function nextRuns(expr: string, from: Date, count: number): Date[] {
  const runs: Date[] = [];
  for (let at = from; runs.length < count; ) {
    const next = nextCronRun(expr, at, 31 * 24 * 60);
    if (!next) break;
    runs.push(next);
    at = next;
  }
  return runs;
}

/** What the automation fires, as one short label. */
function targetLabel(target: Automation["target"]): string {
  if (target.type === "agent") return `agent · ${target.agentId}`;
  if (target.type === "workflow") return `workflow · ${target.workflowId}`;
  if (target.type === "task") return target.target?.name ?? target.text;
  return target.type;
}

/**
 * Automation detail (Bridge "Automation runs" widget): schedule, target, prompt and last run,
 * with "Run now" top-right — the same `POST /automations/:id/trigger` as the automations page.
 */
export function AutomationSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const a = useTranslations("bridge.widgets.automationRuns");
  const router = useRouter();
  const format = useFormatter();
  const cronLabel = useCronLabel();
  const { data: automations } = useAutomationsQuery();
  const trigger = useTriggerAutomationMutation();
  const [now] = useState(() => new Date());
  const [runDialog, setRunDialog] = useState(false);

  const automation = automations?.find((x) => x.id === id);
  if (!automation) return null;
  const { trigger: when, prompt, lastFiredAt, lastFire } = automation;
  const stamp = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: "short",
      timeStyle: "short",
      hourCycle: "h23",
      timeZone: SCHEDULE_TIME_ZONE,
    });

  const upcoming = when.type === "cron" && automation.enabled ? nextRuns(when.expr, now, 7) : [];
  const day = (d: Date) =>
    format.dateTime(d, { weekday: "short", day: "numeric", timeZone: SCHEDULE_TIME_ZONE });
  const first = upcoming[0];

  return (
    <>
      <AnchoredSheet
        {...geometry(anchor, frame)}
        actions={
          <SheetAction
            data-testid={AutomationSheetTestId.RunNow}
            disabled={trigger.isPending}
            intent="primary"
            onClick={() =>
              automationTakesPrompt(automation.target)
                ? setRunDialog(true)
                : trigger.mutate({ params: { id }, body: {} })
            }
          >
            {a("runNow")}
          </SheetAction>
        }
        closeLabel={t("bridge.sheet.close")}
        copyId={id}
        footerNote={
          first
            ? a("note.next", {
                when: stamp(first.toISOString()),
                target: targetLabel(automation.target),
              })
            : automation.enabled
              ? a("note.manual", { target: targetLabel(automation.target) })
              : a("note.disabled")
        }
        glyph="clock"
        kind={t("bridge.sheet.kind.automation")}
        meta={
          <Typography as="span" type="labelSm" variant="secondary">
            {targetLabel(automation.target)}
          </Typography>
        }
        onClose={onClose}
        onTitleClick={() => router.push(`/work/automations/${encodeURIComponent(id)}` as Route)}
        title={automation.name ?? automation.id}
        tones={[
          { tone: "idle", label: automation.enabled ? a("active") : a("disabled") },
          ...(lastFire?.status === "error"
            ? [{ tone: "error" as const, label: a("lastFailed") }]
            : []),
        ]}
      >
        <SheetSection>
          {when.type === "cron" ? (
            <SheetBlock label={a("schedule")}>
              <div data-testid={AutomationSheetTestId.Schedule}>
                <SheetText lines={[cronLabel(when.expr)]} />
                <Typography as="span" type="code" variant="secondary">
                  {when.expr}
                </Typography>
              </div>
              {upcoming.length > 0 ? (
                <div aria-label={a("nextRuns")} data-testid={AutomationSheetTestId.NextRuns}>
                  <Typography as="span" type="code" variant="secondary">
                    {upcoming.map(day).join(" · ")}
                  </Typography>
                </div>
              ) : null}
            </SheetBlock>
          ) : null}
          {prompt ? (
            <SheetBlock label={a("prompt")}>
              <div data-testid={AutomationSheetTestId.Prompt}>
                <SheetText lines={prompt.split("\n")} />
              </div>
            </SheetBlock>
          ) : null}
          <SheetBlock label={a("lastFired")}>
            {lastFire ? (
              // todo-5: the latest fire — status · start · duration, then its log (live
              // while running) or, for a run-backed fire, a link to the run.
              <Stack gap="100">
                <div data-testid={AutomationSheetTestId.LastFire}>
                  <Stack align="center" direction="row" gap="100">
                    <AutomationFireStatus fire={lastFire} />
                    <SheetText
                      lines={[
                        [
                          stamp(lastFire.startedAt),
                          lastFire.durationMs === undefined
                            ? undefined
                            : formatDuration(lastFire.durationMs),
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      ]}
                    />
                  </Stack>
                </div>
                <AutomationFireLog fire={lastFire} key={lastFire.id} />
              </Stack>
            ) : (
              <SheetText lines={[lastFiredAt ? stamp(lastFiredAt) : a("never")]} />
            )}
          </SheetBlock>
        </SheetSection>
      </AnchoredSheet>
      {runDialog && <RunAutomationDialog automationId={id} onClose={() => setRunDialog(false)} />}
    </>
  );
}
