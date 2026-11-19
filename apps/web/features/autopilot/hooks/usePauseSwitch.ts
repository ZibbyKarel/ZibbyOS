"use client";

import type { AutopilotAutomation } from "@zibby/contracts";
import { useState } from "react";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { EMPTY_AUTOMATION } from "../autonomy";
import { useSetAutopilotMutation } from "../mutations";
import { useAutopilotQuery } from "../queries";

export type PauseError = "token" | "failed" | null;

/**
 * The pause switch. Pausing never needs the operator token; resuming does, so a 401 surfaces as
 * `error: "token"` (the levels page has the field to store one).
 */
export function usePauseSwitch() {
  const { data } = useAutopilotQuery();
  const set = useSetAutopilotMutation();
  const [error, setError] = useState<PauseError>(null);
  const paused = data?.paused ?? false;
  const automation: AutopilotAutomation = data?.automation ?? EMPTY_AUTOMATION;

  return {
    paused,
    automation,
    pendingApprovals: data?.pendingApprovals ?? 0,
    /** Flip the switch; `onDone` gets the new `paused`. */
    toggle: (onDone?: (paused: boolean) => void) => {
      setError(null);
      set.mutate(
        { body: { paused: !paused } },
        {
          onSuccess: () => onDone?.(!paused),
          onError: (e) => setError(isOperatorTokenError(e) ? "token" : "failed"),
        },
      );
    },
    pending: set.isPending,
    error,
  };
}
