"use client";
import { useWdT } from "./useWdT";
import { MODEL_TIERS, type PhaseEscalation, type PhaseLoop } from "@zibby/contracts";
import {
  Button,
  Container,
  Dropdown,
  SegmentedControl,
  SelectField,
  Stack,
  Stepper,
  ToggleField,
  Typography,
} from "@zibby/design-system";

export const MAX_RETRIES = 9;

export interface LoopTarget {
  id: string;
  label: string;
}

export interface LoopFieldsProps {
  loop: PhaseLoop;
  /** Earlier phases the loop can return to. */
  retryTargets: readonly LoopTarget[];
  /** Phases the loop can continue at once its retries are spent. */
  thenTargets: readonly LoopTarget[];
  onChange: (loop: PhaseLoop) => void;
  onRemove: () => void;
}

type ThenMode = "phase" | "park" | "fail";
const thenMode = (then: string): ThenMode =>
  then === "park" ? "park" : then === "fail" ? "fail" : "phase";

const THINKING = ["high", "medium", "low"] as const;

/** Rung `i` (0-based) of the ladder, `{}` when not set yet. */
const rung = (loop: PhaseLoop, i: number): PhaseEscalation => loop.escalation?.[i] ?? {};

/** Drops trailing empty rungs so a cleared ladder serialises to no `escalation` at all. */
const trimLadder = (ladder: PhaseEscalation[]): PhaseEscalation[] => {
  const out = [...ladder];
  while (out.length && !out[out.length - 1]!.model && !out[out.length - 1]!.thinking) out.pop();
  return out;
};

/**
 * The editable fields of one loop — retry target, max retries, effort escalation, what happens
 * when the retries run out and the per-attempt model ladder. Shared by the loop popover on the
 * canvas and the inspector's "Loop and retries" section.
 */
export function LoopFields({
  loop,
  retryTargets,
  thenTargets,
  onChange,
  onRemove,
}: LoopFieldsProps) {
  const t = useWdT("workflowDetail.loop");
  const mode = thenMode(loop.then);
  const patch = (change: Partial<PhaseLoop>) => onChange({ ...loop, ...change });
  const setRung = (i: number, change: PhaseEscalation) => {
    const ladder: PhaseEscalation[] = Array.from({ length: loop.maxRetries }, (_, k) => ({
      ...rung(loop, k),
    }));
    ladder[i] = { ...ladder[i], ...change };
    // Choosing "same" clears the key rather than storing `undefined`.
    for (const r of ladder) {
      if (!r.model) delete r.model;
      if (!r.thinking) delete r.thinking;
    }
    const next = trimLadder(ladder);
    onChange({ ...loop, escalation: next.length ? next : undefined });
  };

  return (
    <Stack data-testid="loop-fields" gap="150">
      <SelectField
        label={t("retryTarget")}
        onValueChange={(to) => patch({ to })}
        options={[
          ...retryTargets.map((x) => ({ value: x.id, label: x.label })),
          { value: "fail", label: t("failRun") },
        ]}
        value={loop.to}
      />

      <Stack align="center" direction="row" gap="150" justify="between">
        <Typography size="sm" type="note">
          {t("maxRetries")}
        </Typography>
        <Stepper
          aria-label={t("maxRetries")}
          decreaseLabel={t("retriesDown")}
          increaseLabel={t("retriesUp")}
          max={MAX_RETRIES}
          min={0}
          onChange={(maxRetries) => patch({ maxRetries })}
          value={loop.maxRetries}
        />
      </Stack>

      <ToggleField
        checked={loop.escalate}
        hint={t("escalateHint")}
        label={t("escalate")}
        labelCase="normal"
        onChange={(escalate) => patch({ escalate })}
        size="sm"
      />

      <Stack gap="75">
        <Typography size="xs" type="note" variant="tertiary">
          {t("then")}
        </Typography>
        <SegmentedControl
          ariaLabel={t("then")}
          items={[
            { value: "phase", label: t("thenPhase") },
            { value: "park", label: t("thenPark") },
            { value: "fail", label: t("thenFail") },
          ]}
          onChange={(m) => {
            if (m === "park" || m === "fail") return patch({ then: m });
            patch({ then: thenTargets[0]?.id ?? "park" });
          }}
          size="sm"
          value={mode}
        />
        {mode === "phase" && (
          <SelectField
            label={t("thenPhaseLabel")}
            onValueChange={(then) => patch({ then })}
            options={thenTargets.map((x) => ({ value: x.id, label: x.label }))}
            value={loop.then}
          />
        )}
      </Stack>

      {loop.maxRetries > 0 && (
        <Stack data-testid="loop-ladder" gap="75">
          <Typography size="xs" type="note" variant="tertiary">
            {t("ladder")}
          </Typography>
          <Container
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: loop.maxRetries }, (_, i) => (
              <Container
                data-testid={`loop-rung-${i + 1}`}
                key={i}
                padding={["75", "100"]}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px minmax(0,1fr) minmax(0,1fr)",
                  gap: 8,
                  alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <Typography mono size="xs" type="note" variant="secondary">
                  {t("attempt", { n: i + 2 })}
                </Typography>
                <Dropdown
                  aria-label={t("rungModel", { n: i + 2 })}
                  onChange={(model) =>
                    setRung(i, { model: (model || undefined) as PhaseEscalation["model"] })
                  }
                  options={[
                    { value: "", label: t("same") },
                    ...MODEL_TIERS.map((m) => ({ value: m, label: m })),
                  ]}
                  size="sm"
                  value={rung(loop, i).model ?? ""}
                  variant="field"
                />
                <Dropdown
                  aria-label={t("rungThinking", { n: i + 2 })}
                  onChange={(thinking) =>
                    setRung(i, { thinking: (thinking || undefined) as PhaseEscalation["thinking"] })
                  }
                  options={[
                    { value: "", label: t("same") },
                    ...THINKING.map((m) => ({ value: m, label: m })),
                  ]}
                  size="sm"
                  value={rung(loop, i).thinking ?? ""}
                  variant="field"
                />
              </Container>
            ))}
          </Container>
        </Stack>
      )}

      <Stack direction="row" justify="end">
        <Button icon="trash" intent="ghost" onClick={onRemove} size="sm">
          {t("remove")}
        </Button>
      </Stack>
    </Stack>
  );
}
