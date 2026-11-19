import type { AutopilotLevel } from "@zibby/contracts";
import type { RadioCardTone, ZibbyMode, ZibbyOrbState } from "@zibby/design-system";

export const MODES: readonly ZibbyMode[] = ["manual", "semi", "auto"];

/** The orb state that stands for each mode (sleeping / thinking / speaking). */
export const MODE_ORB: Record<ZibbyMode, ZibbyOrbState> = {
  manual: "sleep",
  semi: "think",
  auto: "speak",
};

export const MODE_TONE: Record<ZibbyMode, RadioCardTone> = {
  manual: "neutral",
  semi: "violet",
  auto: "amber",
};

/** Header mode of the stored level: `off` = Poloautomat, `full` = Automat. Manuál is never stored. */
export const modeOf = (level: AutopilotLevel | undefined): ZibbyMode =>
  level === "full" ? "auto" : "semi";
