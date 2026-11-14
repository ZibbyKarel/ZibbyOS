"use client";

import type { AiEngine, LimitWindow } from "@zibby/contracts";
import { BoardTag, Container, Meter, Stack, Typography } from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { formatResetIn } from "../../../components/layout/LimitsRings/formatResetIn";
import { useNow } from "../../../hooks/useNow";
import { DAY_MS, HOUR_MS } from "../../../utils/time";
import { useAiEnginesQuery, useAiUsageQuery } from "../../ai-providers";
import { useLimitsQuery } from "../../limits/queries";
import { useSystemConfigQuery } from "../../system";
import { formatCostUsd } from "../../../utils/cost";

export enum AiUsageSectionTestId {
  Claude = "ai-usage-claude",
  ClaudeNote = "ai-usage-claude-note",
  Opencode = "ai-usage-opencode",
  Global = "ai-usage-global",
  ActiveModel = "ai-usage-active-model",
  Unavailable = "ai-usage-unavailable",
  Empty = "ai-usage-empty",
  ModelRow = "ai-usage-model-row",
  Cost = "ai-usage-cost",
  Totals = "ai-usage-totals",
}

const NOW_TICK_MS = 30_000;

/** A meter turns amber from this share (same threshold as the budget rows). */
const HOT_PCT = 85;
const ROLLING_MS = 5 * HOUR_MS;
const WEEKLY_MS = 7 * DAY_MS;

/**
 * Linear burn-rate forecast: ms until the window hits 100 %, from the usage so far and the window
 * start (`resetsAt` minus the window length). Only when the meter is hot and the forecast lands
 * before the window resets; otherwise `undefined` (no prediction shown).
 */
export function runsOutInMs(w: LimitWindow, lengthMs: number, now: number): number | undefined {
  if (w.resetsAt === null || w.usedPct < HOT_PCT || w.usedPct >= 100) return undefined;
  const elapsed = now - (w.resetsAt - lengthMs);
  if (elapsed <= 0 || elapsed > lengthMs) return undefined;
  const left = ((100 - w.usedPct) * elapsed) / w.usedPct;
  return now + left < w.resetsAt ? left : undefined;
}

interface ClaudeLimitMeterProps {
  label: string;
  window: LimitWindow;
  lengthMs: number;
  now: number;
}

function ClaudeLimitMeter({ label, window: w, lengthMs, now }: ClaudeLimitMeterProps) {
  const t = useTranslations("bridge.widgets.aiUsage");
  const hot = w.usedPct >= HOT_PCT;
  const left = runsOutInMs(w, lengthMs, now);
  const runsOut = left === undefined ? null : formatResetIn(now + left, now);
  const resetIn = formatResetIn(w.resetsAt, now);
  return (
    <Meter
      label={label}
      note={
        runsOut
          ? t("runsOut", { time: runsOut })
          : resetIn
            ? t("resetsIn", { time: resetIn })
            : undefined
      }
      pct={w.usedPct}
      tone={w.usedPct >= 100 ? "bad" : hot ? "hot" : "ok"}
      value={`${w.usedPct} %`}
    />
  );
}

export interface AiUsageSectionProps {
  /** Claude's 5h + weekly lines (default true). The top bar's sheet passes false: the operator trimmed them from the sheet (todo-5). */
  claudeLimits?: boolean;
}

/**
 * "AI usage" block of the Budgets widget (the dashboard's limits home — the widget catalog is a
 * contract enum, so this lives inside the existing widget instead of a new type): Claude's 5h and
 * weekly limits, and opencode's active model plus recorded usage per provider/model. opencode
 * exposes no quota, so there are no percentages for it. Marks the globally selected engine.
 */
export function AiUsageSection({ claudeLimits = true }: AiUsageSectionProps) {
  const t = useTranslations("bridge.widgets.aiUsage");
  const tl = useTranslations("limits");
  const now = useNow(NOW_TICK_MS);
  const limits = useLimitsQuery().data;
  const usage = useAiUsageQuery().data;
  const engines = useAiEnginesQuery().data?.engines;
  const config = useSystemConfigQuery().data;
  // A31: the Claude family spends the subscription (limits first); openai / free show tokens and cost.
  const active: AiEngine =
    (config?.aiEngine ?? "opencode") === "opencode" &&
    (config?.modelFamily ?? "claude") !== "claude"
      ? "opencode"
      : "claude";
  // The usage endpoint answers `available`; the engines list is the fallback while it loads.
  const opencodeAvailable =
    usage?.opencode.available ?? engines?.find((e) => e.id === "opencode")?.available;

  const globalTag = (id: AiEngine) =>
    active === id ? (
      <span data-testid={`${AiUsageSectionTestId.Global}-${id}`}>
        <BoardTag variant="you">{t("global")}</BoardTag>
      </span>
    ) : null;

  const claudeRow = (
    <Container key="claude" padding={["100", "150"]}>
      <span data-testid={AiUsageSectionTestId.Claude}>
        <Stack gap="100">
          <Stack align="center" direction="row" gap="100" justify="between">
            <Typography type="note" weight="medium">
              {t("claude")}
            </Typography>
            {globalTag("claude")}
          </Stack>
          {claudeLimits &&
            (limits ? (
              <>
                <ClaudeLimitMeter
                  label={tl("rollingLabel")}
                  lengthMs={ROLLING_MS}
                  now={now}
                  window={limits.rolling}
                />
                <ClaudeLimitMeter
                  label={tl("weeklyLabel")}
                  lengthMs={WEEKLY_MS}
                  now={now}
                  window={limits.weekly}
                />
              </>
            ) : (
              <Typography size="sm" type="note" variant="tertiary">
                {t("limitsUnknown")}
              </Typography>
            ))}
          {active === "opencode" && (
            <span data-testid={AiUsageSectionTestId.ClaudeNote}>
              <Typography leading="snug" size="2xs" type="note" variant="tertiary">
                {t("claudeStillApplies")}
              </Typography>
            </span>
          )}
        </Stack>
      </span>
    </Container>
  );
  const opencodeRow = (
    <Container key="opencode" padding={["100", "150"]}>
      <span data-testid={AiUsageSectionTestId.Opencode}>
        <Stack gap="100">
          <Stack align="center" direction="row" gap="100" justify="between">
            <Typography type="note" weight="medium">
              {t("opencode")}
            </Typography>
            {globalTag("opencode")}
          </Stack>
          <OpencodeBody available={opencodeAvailable} model={config?.opencodeModel ?? ""} />
        </Stack>
      </span>
    </Container>
  );

  // The globally selected engine's block comes first.
  return <>{active === "opencode" ? [opencodeRow, claudeRow] : [claudeRow, opencodeRow]}</>;
}

interface OpencodeBodyProps {
  available: boolean | undefined;
  model: string;
}

function OpencodeBody({ available, model }: OpencodeBodyProps) {
  const t = useTranslations("bridge.widgets.aiUsage");
  const locale = useLocale();
  const usage = useAiUsageQuery().data;
  if (available === undefined) return null;
  if (!available) {
    return (
      <span data-testid={AiUsageSectionTestId.Unavailable}>
        <Typography size="sm" type="note" variant="tertiary">
          {t("unavailable")}
        </Typography>
      </span>
    );
  }
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const cost = (usd: number, providerId?: string) =>
    usd !== 0 ? formatCostUsd(usd) : providerId === "claude-agent" ? t("subscription") : t("free");
  const line = (u: NonNullable<typeof usage>["opencode"]["totals"]) =>
    t("line", {
      steps: u.steps,
      input: compact.format(u.tokens.input),
      output: compact.format(u.tokens.output),
    });
  const modelName = (m: { providerId: string; modelId: string; variant?: string | undefined }) =>
    `${m.providerId}/${m.modelId}${m.variant ? ` (${m.variant})` : ""}`;
  const models = usage?.opencode.models ?? [];
  const totals = usage?.opencode.totals;

  return (
    <>
      <span data-testid={AiUsageSectionTestId.ActiveModel}>
        <Typography size="sm" type="note">
          {model === "" ? t("noModel") : t("activeModel", { model })}
        </Typography>
      </span>
      {models.length === 0 ? (
        <span data-testid={AiUsageSectionTestId.Empty}>
          <Typography size="sm" type="note" variant="tertiary">
            {t("empty", { days: usage?.days ?? 30 })}
          </Typography>
        </span>
      ) : (
        <>
          {models.map((m) => (
            <span
              data-testid={AiUsageSectionTestId.ModelRow}
              key={`${m.providerId}/${m.modelId}/${m.variant ?? ""}`}
            >
              <Stack gap="25">
                <span title={modelName(m)}>
                  <Typography mono truncate size="sm" type="note">
                    {modelName(m)}
                  </Typography>
                </span>
                <Typography size="sm" type="note" variant="tertiary">
                  {`${line(m)} · `}
                  <span data-testid={AiUsageSectionTestId.Cost}>
                    {cost(m.costUsd, m.providerId)}
                  </span>
                </Typography>
              </Stack>
            </span>
          ))}
          {totals && (
            <span data-testid={AiUsageSectionTestId.Totals}>
              <Stack direction="row" gap="100" justify="between">
                <Typography size="sm" type="note">
                  {t("totals", { days: usage.days })}
                </Typography>
                <Typography
                  size="sm"
                  type="note"
                >{`${line(totals)} · ${cost(totals.costUsd)}`}</Typography>
              </Stack>
            </span>
          )}
        </>
      )}
    </>
  );
}
