"use client";

import { RadioCard, RadioCardGroup, type ZibbyMode, ZibbyOrb } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { MODES, MODE_ORB, MODE_TONE } from "../modeMeta";

export enum ZibbyModeCardsTestId {
  Card = "zibby-mode-card",
}

export interface ZibbyModeCardsProps {
  mode: ZibbyMode;
  onSelect: (mode: ZibbyMode) => void;
  /** Bigger orbs (the phone sheet). */
  big?: boolean;
}

/** The three mode radio cards (Manuál / Poloautomat / Automat), each with its orb. Manuál is disabled. */
export function ZibbyModeCards({ mode, onSelect, big = false }: ZibbyModeCardsProps) {
  const t = useTranslations("autopilot");
  return (
    <RadioCardGroup ariaLabel={t("zibbyModeLabel")}>
      {MODES.map((m) => {
        const label = t(`mode_${m}`);
        const state = t(`modeState_${m}`);
        const disabled = m === "manual";
        const desc = disabled ? t("manualNeedsRunner") : t(`modeDesc_${m}`);
        return (
          <RadioCard
            aria-label={`${label}, ${t("zibbyIs", { state: state.toLowerCase() })}. ${desc}`}
            checked={mode === m}
            data-mode={m}
            data-testid={`${ZibbyModeCardsTestId.Card}-${m}`}
            disabled={disabled}
            hint={state}
            key={m}
            label={label}
            media={<ZibbyOrb size={big ? 40 : 30} state={MODE_ORB[m]} />}
            onSelect={() => onSelect(m)}
            title={desc}
            tone={MODE_TONE[m]}
          />
        );
      })}
    </RadioCardGroup>
  );
}
