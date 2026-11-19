"use client";

import { type AutopilotAutomation, NO_AUTOMATION } from "@zibby/contracts";
import type { ZibbyMode } from "@zibby/design-system";
import { useState } from "react";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { EMPTY_AUTOMATION } from "../autonomy";
import { modeOf } from "../modeMeta";
import { useSetAutopilotMutation } from "../mutations";
import { useAutopilotQuery } from "../queries";
import { saveOperatorToken } from "./useHasOperatorToken";

export type ConfirmError = "token" | "failed" | null;

/**
 * The header mode: Poloautomat = level `off`, Automat = `full`. Switching down is instant
 * (`{ level: "off" }` only, the tree is kept). Switching to Automat first asks for confirmation;
 * `confirm` then sends the stored tree with `global` forced all-off (never omitted: a state
 * without a tree would cover everything), after saving a typed token. Manuál is not selectable.
 */
export function useModeSwitch(onChanged?: (mode: ZibbyMode) => void) {
  const { data } = useAutopilotQuery();
  const set = useSetAutopilotMutation();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ConfirmError>(null);
  const mode = modeOf(data?.level);
  const automation: AutopilotAutomation = data?.automation ?? EMPTY_AUTOMATION;

  const select = (next: ZibbyMode) => {
    if (next === "manual" || next === mode) return;
    if (next === "auto") {
      setError(null);
      setConfirming(true);
      return;
    }
    set.mutate({ body: { level: "off" } }, { onSuccess: () => onChanged?.("semi") });
  };

  const confirm = (typedToken?: string) => {
    if (typedToken) saveOperatorToken(typedToken);
    set.mutate(
      { body: { level: "full", automation: { ...automation, global: { ...NO_AUTOMATION } } } },
      {
        onSuccess: () => {
          setConfirming(false);
          setError(null);
          onChanged?.("auto");
        },
        onError: (e) => setError(isOperatorTokenError(e) ? "token" : "failed"),
      },
    );
  };

  return {
    mode,
    automation,
    pendingApprovals: data?.pendingApprovals ?? 0,
    select,
    confirming,
    confirm,
    cancel: () => {
      setConfirming(false);
      setError(null);
    },
    pending: set.isPending,
    error,
  };
}
