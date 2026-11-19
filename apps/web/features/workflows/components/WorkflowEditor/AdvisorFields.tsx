"use client";
import { MODEL_TIERS, type PhaseAdvisor } from "@zibby/contracts";
import { SegmentedControl, SelectField, Stack, Stepper, Typography } from "@zibby/design-system";
import { useWdT } from "./useWdT";

export interface AdvisorFieldsProps {
  /** `undefined` = inherit / not configured, `false` = off (phase level only), object = custom. */
  value: PhaseAdvisor | false | undefined;
  onChange: (value: PhaseAdvisor | false | undefined) => void;
  /** A phase can turn the workflow's advisor off and inherit it; the workflow itself can't. */
  phaseLevel: boolean;
  /** Phase ids the advisor may fork from. */
  forkTargets: readonly { id: string; label: string }[];
}

const THINKING = ["high", "medium", "low"] as const;
const DEFAULTS: PhaseAdvisor = { model: "opus", thinking: "high", maxCalls: 3 };

/**
 * The advisor (`ask_advisor`) settings of a phase or of the whole workflow: off / inherit /
 * custom model, thinking, call cap and the phase whose session it forks.
 */
export function AdvisorFields({ value, onChange, phaseLevel, forkTargets }: AdvisorFieldsProps) {
  const t = useWdT("workflowDetail.advisor");
  const mode = value === false ? "off" : value ? "custom" : "inherit";
  const custom = value ? value : undefined;
  const patch = (change: Partial<PhaseAdvisor>) => onChange({ ...(custom ?? DEFAULTS), ...change });
  return (
    <Stack data-testid="advisor-fields" gap="100">
      <Typography leading="snug" size="xs" type="note" variant="tertiary">
        {t("hint")}
      </Typography>
      <SegmentedControl
        ariaLabel={t("mode")}
        items={[
          { value: "inherit", label: phaseLevel ? t("inherit") : t("none") },
          ...(phaseLevel ? [{ value: "off", label: t("off") }] : []),
          { value: "custom", label: t("custom") },
        ]}
        onChange={(m) =>
          onChange(m === "off" ? false : m === "custom" ? (custom ?? DEFAULTS) : undefined)
        }
        size="sm"
        value={mode}
      />
      {custom && (
        <Stack gap="100">
          <SelectField
            label={t("model")}
            onValueChange={(model) => patch({ model: model as PhaseAdvisor["model"] })}
            options={MODEL_TIERS.map((m) => ({ value: m, label: m }))}
            value={custom.model ?? DEFAULTS.model!}
          />
          <SelectField
            label={t("thinking")}
            onValueChange={(thinking) => patch({ thinking: thinking as PhaseAdvisor["thinking"] })}
            options={THINKING.map((m) => ({ value: m, label: m }))}
            value={custom.thinking ?? DEFAULTS.thinking!}
          />
          <Stack align="center" direction="row" gap="100" justify="between">
            <Typography size="sm" type="note">
              {t("maxCalls")}
            </Typography>
            <Stepper
              aria-label={t("maxCalls")}
              max={20}
              min={1}
              onChange={(maxCalls) => patch({ maxCalls })}
              value={custom.maxCalls ?? DEFAULTS.maxCalls!}
            />
          </Stack>
          <SelectField
            label={t("from")}
            onValueChange={(from) => {
              const rest = { ...custom, from: undefined };
              onChange({ ...rest, from: from || undefined } as PhaseAdvisor);
            }}
            options={[
              { value: "", label: t("fromAuto") },
              ...forkTargets.map((x) => ({ value: x.id, label: x.label })),
            ]}
            value={custom.from ?? ""}
          />
        </Stack>
      )}
    </Stack>
  );
}
