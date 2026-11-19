"use client";

import { type AutopilotAutomation, NO_AUTOMATION } from "@zibby/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClient } from "../../../state/api";
import { isOperatorTokenError } from "../../../state/operatorToken";
import { sameAutomation } from "../autonomy";
import { useSetAutopilotMutation } from "../mutations";
import { getAutopilotQueryKey } from "../queries";

/** `ok` = stored as sent; `locked` = the API ignored it or said 401 (no valid operator token). */
export type SaveResult = "ok" | "locked" | "failed";

/**
 * Writes the automation tree. The level is re-read right before the write and sent unchanged, so
 * a tree edit can never raise it (a stale cached `full` would undo a chat `autopilot_off`).
 * `global` is always forced all-off. Without a valid token the API answers 200 but silently drops
 * the tree at `off`, so the response is compared with what was sent.
 */
export function useSaveAutomation() {
  const qc = useQueryClient();
  const { mutateAsync } = useSetAutopilotMutation();
  return useCallback(
    async (automation: AutopilotAutomation): Promise<SaveResult> => {
      try {
        const fresh = await apiClient.autopilot.getAutopilot.query();
        if (fresh.status !== 200) return "failed";
        const sent = { ...automation, global: { ...NO_AUTOMATION } };
        const res = await mutateAsync({ body: { level: fresh.body.level, automation: sent } });
        await qc.refetchQueries({ queryKey: getAutopilotQueryKey() });
        return sameAutomation(res.body.automation, sent) ? "ok" : "locked";
      } catch (error) {
        return isOperatorTokenError(error) ? "locked" : "failed";
      }
    },
    [mutateAsync, qc],
  );
}
