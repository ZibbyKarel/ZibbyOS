import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";
import { getTeamKbGraphQueryKey } from "./useTeamKbGraphQuery";

const combine = <T extends { data: unknown; isPending: boolean; isError: boolean }>(results: T[]) =>
  results.map((r) => ({ data: r.data, isPending: r.isPending, isError: r.isError }));

/** The graphs of several team KBs at once (client-side fan-out); same cache keys as `useTeamKbGraphQuery`. */
export function useTeamKbGraphsQuery(teamIds: readonly string[]) {
  return apiClient.teams.getTeamKbGraph.useQueries({
    queries: teamIds.map((id) => ({
      queryKey: getTeamKbGraphQueryKey(id),
      queryData: { params: { id } },
      select: selectApiResponseBody,
      retry: false,
    })),
    combine,
  });
}
