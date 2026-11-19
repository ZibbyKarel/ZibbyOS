import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Cache key for a project's vault TODO.md items. Exported so mutations can invalidate it. */
export function getProjectTodoQueryKey(projectId: string) {
  return ["todo", "projects", projectId] as const;
}

/** A project's TODO.md items from `GET /api/todo/projects/:projectId`; `data` is `{ items }`. */
export function useProjectTodoQuery(projectId: string | undefined) {
  return apiClient.todo.listProjectTodo.useQuery({
    queryKey: getProjectTodoQueryKey(projectId ?? ""),
    queryData: { params: { projectId: projectId ?? "" } },
    select: selectApiResponseBody,
    enabled: projectId !== undefined,
  });
}
