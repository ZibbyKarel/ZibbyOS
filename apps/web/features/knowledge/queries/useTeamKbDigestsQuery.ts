import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";
import { getTeamKbDigestQueryKey } from "../../teams/queries";

const combine = <T extends { data: unknown; isPending: boolean; isError: boolean }>(results: T[]) =>
  results.map((r) => ({ data: r.data, isPending: r.isPending, isError: r.isError }));

/** The open-question digests of several team KBs at once; same cache keys as `useTeamKbDigestQuery`. */
export function useTeamKbDigestsQuery(teamIds: readonly string[]) {
  return apiClient.teams.getTeamKbDigest.useQueries({
    queries: teamIds.map((id) => ({
      queryKey: getTeamKbDigestQueryKey(id),
      queryData: { params: { id } },
      select: selectApiResponseBody,
      staleTime: 5 * 60_000,
      retry: false,
    })),
    combine,
  });
}
