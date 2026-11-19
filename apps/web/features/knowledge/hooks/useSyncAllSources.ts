"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncTeamKbMutation } from "../mutations";
import { getMemoryGraphQueryKey } from "../queries";
import { VAULT_SOURCE_ID } from "../brainModel";

export type SyncPhase = "queued" | "pulling" | "done" | "failed";

export interface SourceSync {
  phase: SyncPhase;
  /** `git pull` result for a KB ("Staženo a → b" is composed by the UI from these), or the failure message. */
  updated?: boolean;
  message?: string;
}

type Err = { status?: number; body?: { message?: string } };

/**
 * "Aktualizovat vše": the existing per-team KB sync called for every team KB (one after the other,
 * so the queued/pulling/done states are real), plus a refetch of the vault graph. Per-source
 * state is kept here; `retry(id)` re-runs a single source. There is no sync-all endpoint
 * (deferred) — this is a client-side fan-out.
 */
export function useSyncAllSources(teamIds: readonly string[]) {
  const qc = useQueryClient();
  const sync = useSyncTeamKbMutation();
  const [state, setState] = useState<Record<string, SourceSync>>({});
  const [running, setRunning] = useState(false);

  const set = (id: string, s: SourceSync) => setState((p) => ({ ...p, [id]: s }));

  const runOne = useCallback(
    async (id: string) => {
      set(id, { phase: "pulling" });
      try {
        if (id === VAULT_SOURCE_ID) {
          await qc.refetchQueries({ queryKey: getMemoryGraphQueryKey() }, { throwOnError: true });
          set(id, { phase: "done" });
        } else {
          const res = await sync.mutateAsync({ params: { id }, body: undefined });
          set(id, { phase: "done", updated: res.status === 200 ? res.body.updated : false });
        }
      } catch (e) {
        const err = e as Err;
        set(id, { phase: "failed", message: err.status === 409 ? err.body?.message : undefined });
      }
    },
    [qc, sync],
  );

  const runAll = useCallback(async () => {
    if (running) return;
    const ids = [VAULT_SOURCE_ID, ...teamIds];
    setRunning(true);
    setState(Object.fromEntries(ids.map((id) => [id, { phase: "queued" } as SourceSync])));
    for (const id of ids) await runOne(id);
    setRunning(false);
  }, [running, teamIds, runOne]);

  const retry = useCallback(
    async (id: string) => {
      setRunning(true);
      await runOne(id);
      setRunning(false);
    },
    [runOne],
  );

  return { state, running, runAll, retry };
}
