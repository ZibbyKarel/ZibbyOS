import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Prefix of every project's CI cache entry. */
export function getProjectCiQueryKeyRoot() {
  return ["project-ci"] as const;
}

export function getProjectCiQueryKey(projectId: string) {
  return [...getProjectCiQueryKeyRoot(), projectId] as const;
}

/** Base-branch CI is polled STATE (cached ~60 s server-side), like `useCiStatusQuery`. */
const PROJECT_CI_POLL_MS = 60 * 1000;

/** Base-branch CI of one project — workflows → jobs → steps (`GET /api/project-ci/:projectId`). */
export function useProjectCiQuery(projectId: string) {
  return apiClient.projectCi.getProjectCi.useQuery({
    queryKey: getProjectCiQueryKey(projectId),
    queryData: { params: { projectId } },
    refetchInterval: PROJECT_CI_POLL_MS,
    retry: false,
    select: selectApiResponseBody,
  });
}
