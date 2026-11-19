import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Card,
  Container,
  Divider,
  EngineBadge,
  FlowTilePair,
  Icon,
  type IconName,
  MiniTimeline,
  Stack,
  StatusDot,
  Toggle,
  Typography,
} from "@zibby/design-system";
import type { Automation, Target } from "@zibby/contracts";
import { fireDots, timelinePosition } from "../automationListModel";
import { useAutomationFiresQuery } from "../queries";
import { nextCronRun, relativeLabel } from "../schedule";
import { useAutomationEngineBadge } from "../useAutomationEngineBadge";
import { useCronLabel } from "../useCronLabel";

/** Testids for the automation card (the screen + tests select via these). */
export enum AutomationCardTestId {
  Root = "automation-card",
  Toggle = "automation-card-toggle",
  Edit = "automation-card-edit",
  Run = "automation-card-run",
  Schedule = "automation-card-schedule",
  Target = "automation-card-target",
}

const TRIGGER_GLYPH = { cron: "clock", event: "bolt", signal: "pulse" } as const satisfies Record<
  string,
  IconName
>;
// `task` isn't in here — its glyph depends on the @-mentioned target's OWN kind
// (agent/workflow/none), resolved by `taskGlyph` below, not a static per-type map.
const TARGET_GLYPH = {
  agent: "bot",
  workflow: "flow",
  briefing: "spark",
  "memory-distill": "brain",
  "pattern-extract": "pulse",
  "gap-detect": "flask",
  "agent-factory": "gear",
  // F4c: no dedicated "eye"/"scan" glyph exists in the DS icon set — "brain" is
  // pre-approved as the fallback (reused from `memory-distill`, same memory domain).
  "self-knowledge": "brain",
  "vault-lint": "brain",
  "slack-digest": "chat",
  // NS2 F5a — Security's scheduled security watch: the DS "shield" glyph.
  "security-scan": "shield",
  // NS2 F5c — Arch's nightly quality audit: the DS "code" glyph.
  "arch-audit": "code",
  // PR review learning v1 — "brain" again: same learning/memory domain as
  // `memory-distill`/`self-knowledge`, no dedicated glyph exists for it.
  "review-learn": "brain",
  // Weekly external-skills update: the DS "retry" (refresh) glyph.
  "external-skills-sync": "retry",
} as const satisfies Record<Exclude<Target["type"], "task">, IconName>;

/** A `task` automation's glyph mirrors its @-mentioned run target (Screen.tsx's
 *  own `resolveTarget` computes the same thing when it CAN resolve a stored
 *  agent/workflow's real glyph; this is the fallback for when no `targetGlyph`
 *  prop is supplied — e.g. this card rendered standalone). */
function taskGlyph(target: Extract<Target, { type: "task" }>): IconName {
  const kind = target.target?.kind;
  return kind === "agent" ? "bot" : kind === "workflow" ? "flow" : "spark";
}

export interface AutomationCardProps {
  automation: Automation;
  /** Resolved display name for the target (agent / workflow); falls back to id. */
  targetName?: string;
  /** Resolved icon for the target; falls back to a per-kind default. */
  targetGlyph?: IconName;
  onToggle: () => void;
  onEdit: () => void;
  onTrigger: () => void;
  triggering?: boolean;
}

/**
 * One automation as a list card: status dot + name + big enable switch on top, the
 * trigger -> target tile pair (dashed and dimmed while off), a last/now/next mini
 * timeline (or 7-day fire dots for an event trigger) and the edit / run-now footer.
 */
export function AutomationCard({
  automation,
  targetName,
  targetGlyph,
  onToggle,
  onEdit,
  onTrigger,
  triggering,
}: AutomationCardProps) {
  const t = useTranslations("automations");
  const locale = useLocale();
  const cronLabel = useCronLabel();
  const engineBadge = useAutomationEngineBadge(automation);
  const { trigger, target, enabled } = automation;
  const name = automation.name ?? automation.id;

  const scheduleText =
    trigger.type === "cron"
      ? cronLabel(trigger.expr)
      : trigger.type === "signal"
        ? trigger.kind
        : trigger.events.join(", ");

  // Captured once at mount; the labels are coarse (minutes/hours) and the card is
  // short-lived, so freezing "now" avoids an impure render-time read.
  const [now] = useState(() => Date.now());
  const next = useMemo(
    () => (trigger.type === "cron" ? nextCronRun(trigger.expr, new Date(now)) : null),
    [trigger, now],
  );
  const lastMs = automation.lastFiredAt ? Date.parse(automation.lastFiredAt) : null;
  const lastLabel = lastMs
    ? t("lastRun", { ago: relativeLabel(lastMs, now, locale) })
    : t("neverRun");
  // A disabled automation won't fire, so it must not advertise a phantom next-run —
  // honest status (North Star "always accountable").
  const nextLabel = !enabled
    ? t("nextOff")
    : trigger.type === "event"
      ? t("onEvent")
      : next
        ? t("nextRun", { when: relativeLabel(next.getTime(), now, locale) })
        : "—";

  const targetText =
    target.type === "briefing"
      ? t("targetBriefing")
      : target.type === "memory-distill"
        ? t("targetMemoryDistill")
        : target.type === "self-knowledge"
          ? t("targetSelfKnowledge")
          : target.type === "vault-lint"
            ? t("targetVaultLint")
            : target.type === "slack-digest"
              ? t("targetSlackDigest")
              : target.type === "security-scan"
                ? t("targetSentinelScan")
                : target.type === "arch-audit"
                  ? t("targetLoomAudit")
                  : target.type === "review-learn"
                    ? t("targetReviewLearn")
                    : target.type === "external-skills-sync"
                      ? t("targetExternalSkillsSync")
                      : target.type === "task"
                        ? (targetName ?? target.target?.name ?? t("targetTask"))
                        : (targetName ?? targetIdOf(target));

  const glyph =
    targetGlyph ?? (target.type === "task" ? taskGlyph(target) : TARGET_GLYPH[target.type]);

  return (
    <Card background="surface" data-testid={AutomationCardTestId.Root}>
      <Container padding="200">
        <Stack gap="200">
          {/* header: status + name + enable switch */}
          <Stack align="center" direction="row" gap="200" justify="between">
            <Stack align="center" direction="row" gap="100">
              <StatusDot tone={enabled ? "ok" : "idle"} />
              <Container minW0>
                <Typography truncate size="base" type="note" weight="semibold">
                  {name}
                </Typography>
              </Container>
            </Stack>
            <Stack align="center" direction="row" gap="100">
              <Typography
                size="2xs"
                tone={enabled ? "accent" : undefined}
                type="label"
                variant={enabled ? "secondary" : "tertiary"}
              >
                {enabled ? t("active") : t("off")}
              </Typography>
              <Toggle
                checked={enabled}
                data-testid={AutomationCardTestId.Toggle}
                label={t("toggleLabel", { name })}
                onChange={onToggle}
                size="md"
              />
            </Stack>
          </Stack>

          {automation.description ? (
            <Typography leading="snug" size="caption" type="note" variant="secondary">
              {automation.description}
            </Typography>
          ) : null}

          {/* trigger -> target */}
          <FlowTilePair
            off={!enabled}
            target={{
              icon: (
                <EngineBadge {...engineBadge}>
                  <Icon name={glyph} size="md" />
                </EngineBadge>
              ),
              kicker: t(targetKindKey(target.type)),
              title: targetText,
              testId: AutomationCardTestId.Target,
            }}
            trigger={{
              icon: <Icon name={TRIGGER_GLYPH[trigger.type]} size="md" />,
              kicker: t(trigger.type === "cron" ? "list.when" : "list.whenEvent"),
              title: scheduleText,
              ...(trigger.type === "cron" ? { code: trigger.expr } : {}),
              testId: AutomationCardTestId.Schedule,
            }}
          />

          {trigger.type === "cron" && (
            <MiniTimeline
              last={lastMs !== null}
              leftLabel={lastLabel}
              next={enabled && next !== null}
              now={timelinePosition(lastMs, next?.getTime() ?? null, now) ?? (lastMs ? 100 : 0)}
              nowLabel={t("list.now")}
              off={!enabled}
              rightLabel={nextLabel}
            />
          )}
          {trigger.type === "event" && (
            <EventTimeline automationId={automation.id} now={now} off={!enabled} />
          )}

          <Divider />

          {/* footer: last run for non-cron + actions */}
          <Stack wrap align="center" direction="row" gap="150" justify="between">
            <Typography mono size="2xs" type="micro" variant="tertiary">
              {trigger.type === "cron" ? "" : lastLabel}
            </Typography>
            <Stack align="center" direction="row" gap="100">
              <Button
                data-testid={AutomationCardTestId.Edit}
                icon="edit"
                intent="ghost"
                onClick={onEdit}
                size="sm"
              >
                {t("edit")}
              </Button>
              <Button
                data-testid={AutomationCardTestId.Run}
                icon="play"
                intent="secondary"
                loading={triggering}
                onClick={onTrigger}
                size="sm"
              >
                {t("runNow")}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Card>
  );
}

/** 7-day fire dots of an event trigger; renders nothing until fires exist. */
function EventTimeline({
  automationId,
  now,
  off,
}: {
  automationId: string;
  now: number;
  off: boolean;
}) {
  const t = useTranslations("automations");
  const { data } = useAutomationFiresQuery(automationId);
  const dots = fireDots(data ?? [], now);
  if (dots.length === 0) return null;
  return (
    <MiniTimeline
      fires={dots}
      leftLabel={t("list.sevenDaysAgo")}
      off={off}
      rightLabel={t("list.firesInWeek", { count: dots.length })}
    />
  );
}

/** Display id for an agent/workflow target (used when no resolved name is supplied);
 *  every other target type resolves its display text before ever reaching this. */
function targetIdOf(target: Target): string {
  return target.type === "agent"
    ? target.agentId
    : target.type === "workflow"
      ? target.workflowId
      : "";
}

/** i18n key for the target kind label. Exhaustive over the target union. */
function targetKindKey(
  type: Target["type"],
):
  | "targetAgent"
  | "targetWorkflow"
  | "targetTask"
  | "targetBriefing"
  | "targetMemoryDistill"
  | "targetPatternExtract"
  | "targetGapDetect"
  | "targetAgentFactory"
  | "targetSelfKnowledge"
  | "targetVaultLint"
  | "targetSlackDigest"
  | "targetSentinelScan"
  | "targetLoomAudit"
  | "targetReviewLearn"
  | "targetExternalSkillsSync" {
  switch (type) {
    case "agent":
      return "targetAgent";
    case "workflow":
      return "targetWorkflow";
    case "task":
      return "targetTask";
    case "briefing":
      return "targetBriefing";
    case "memory-distill":
      return "targetMemoryDistill";
    case "pattern-extract":
      return "targetPatternExtract";
    case "gap-detect":
      return "targetGapDetect";
    case "agent-factory":
      return "targetAgentFactory";
    case "self-knowledge":
      return "targetSelfKnowledge";
    case "vault-lint":
      return "targetVaultLint";
    case "slack-digest":
      return "targetSlackDigest";
    case "security-scan":
      return "targetSentinelScan";
    case "arch-audit":
      return "targetLoomAudit";
    case "review-learn":
      return "targetReviewLearn";
    case "external-skills-sync":
      return "targetExternalSkillsSync";
  }
}
