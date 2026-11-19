"use client";

import type { AutopilotAutomation } from "@zibby/contracts";
import { useCallback } from "react";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { useSetAutopilotMutation } from "../mutations";

/** `locked` = the API said 401: raising a level needs a valid operator token. */
export type SaveResult = "ok" | "locked" | "failed";

/** Writes the automation tree (the pause flag is never sent, so a save cannot resume Zibby). */
export function useSaveAutomation() {
  const { mutateAsync } = useSetAutopilotMutation();
  return useCallback(
    async (automation: AutopilotAutomation): Promise<SaveResult> => {
      try {
        await mutateAsync({ body: { automation } });
        return "ok";
      } catch (error) {
        return isOperatorTokenError(error) ? "locked" : "failed";
      }
    },
    [mutateAsync],
  );
}
