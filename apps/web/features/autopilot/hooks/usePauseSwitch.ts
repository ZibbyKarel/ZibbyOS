"use client";

import type { AutopilotAutomation } from "@zibby/contracts";
import { useState } from "react";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { EMPTY_AUTOMATION } from "../autonomy";
import { useSetAutopilotMutation } from "../mutations";
import { useAutopilotQuery } from "../queries";

export type PauseError = "token" | "failed" | null;

/**
 * Resuming autonomy needs the operator token, so a 401 surfaces as `error: "token"` (the TopBar
 * menu shows the field to store one).
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
    /** Lift the pause: always sends `paused: false`, so a retry after the state changed never re-pauses. */
    resume: () => {
      setError(null);
      set.mutate(
        { body: { paused: false } },
        { onError: (e) => setError(isOperatorTokenError(e) ? "token" : "failed") },
      );
    },
    pending: set.isPending,
    error,
  };
}
