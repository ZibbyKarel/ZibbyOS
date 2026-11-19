"use client";

import { useMemo } from "react";
import type { MemoryGraph, TeamKbDigest } from "@zibby/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTeamsQuery } from "../../teams/queries";
import {
  type BrainGraphData,
  type BrainSource,
  VAULT_SOURCE_ID,
  brainId,
  buildBrainGraph,
} from "../brainModel";
import {
  getTeamKbGraphQueryKey,
  useMemoryGraphQuery,
  useTeamKbDigestsQuery,
  useTeamKbGraphsQuery,
} from "../queries";

export type SourceLoadState = "loading" | "ready" | "failed";

export interface BrainSourceInfo extends BrainSource {
  state: SourceLoadState;
  notes: number;
  retry: () => void;
}

export interface OpenQuestion {
  teamId: string;
  teamName: string;
  text: string;
  noteId: string;
  noteTitle: string;
}

export interface BrainData {
  graph: BrainGraphData;
  sources: BrainSourceInfo[];
  openQuestions: OpenQuestion[];
  /** Nothing has loaded yet and at least one source is still loading. */
  isLoading: boolean;
  /** Every source is settled and there are no notes at all. */
  isEmpty: boolean;
}

/**
 * The unified brain, assembled client-side: the vault graph plus every registered team KB graph
 * (fan-out over the existing per-source endpoints), merged by `buildBrainGraph`, with the KBs'
 * digest questions flagged on their notes. A failed source keeps its row (state `failed`) and
 * simply contributes no notes — the rest of the brain still renders.
 */
export function useBrainData(): BrainData {
  const qc = useQueryClient();
  const teams = useTeamsQuery();
  const vault = useMemoryGraphQuery();
  const kbTeams = useMemo(() => (teams.data ?? []).filter((t) => t.knowledgeBase), [teams.data]);
  const ids = useMemo(() => kbTeams.map((t) => t.id), [kbTeams]);
  const graphs = useTeamKbGraphsQuery(ids);
  const digests = useTeamKbDigestsQuery(ids);

  return useMemo(() => {
    const openQuestions: OpenQuestion[] = [];
    kbTeams.forEach((team, i) => {
      for (const q of (digests[i]?.data as TeamKbDigest | undefined)?.questions ?? [])
        openQuestions.push({
          teamId: team.id,
          teamName: team.name,
          text: q.text,
          noteId: q.noteId,
          noteTitle: q.noteTitle,
        });
    });
    const openIds = new Set(openQuestions.map((q) => brainId(q.teamId, q.noteId)));

    const graph = buildBrainGraph({
      vault: vault.data,
      kbs: kbTeams.map((t, i) => ({
        teamId: t.id,
        name: t.name,
        graph: graphs[i]?.data as MemoryGraph | undefined,
      })),
      openIds,
    });
    const count = (sourceId: string) => graph.nodes.filter((n) => n.sourceId === sourceId).length;
    const stateOf = (q: { isPending: boolean; isError: boolean } | undefined): SourceLoadState =>
      !q || q.isPending ? "loading" : q.isError ? "failed" : "ready";

    const sources: BrainSourceInfo[] = [
      {
        id: VAULT_SOURCE_ID,
        kind: "vault",
        name: "ZibbyOS",
        state: stateOf(vault),
        notes: count(VAULT_SOURCE_ID),
        retry: () => void vault.refetch(),
      },
      ...kbTeams.map((t, i) => ({
        id: t.id,
        kind: "kb" as const,
        name: t.name,
        state: stateOf(graphs[i]),
        notes: count(t.id),
        retry: () => void qc.refetchQueries({ queryKey: getTeamKbGraphQueryKey(t.id) }),
      })),
    ];
    const noteCount = graph.nodes.filter((n) => !n.hub).length;
    const loading = sources.some((s) => s.state === "loading");
    return {
      graph,
      sources,
      openQuestions,
      isLoading: noteCount === 0 && loading,
      isEmpty: noteCount === 0 && !loading && sources.every((s) => s.state === "ready"),
    };
  }, [kbTeams, vault, graphs, digests, qc]);
}
