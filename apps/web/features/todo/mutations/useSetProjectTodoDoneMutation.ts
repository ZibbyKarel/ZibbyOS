import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../state/api";
import { getProjectTodoQueryKey } from "../queries/useProjectTodoQuery";

/** Tick / untick a project TODO.md item (`PATCH /api/todo/projects/:projectId/items/:number`). */
export function useSetProjectTodoDoneMutation() {
  const qc = useQueryClient();
  return apiClient.todo.setProjectTodoDone.useMutation({
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: getProjectTodoQueryKey(vars.params.projectId) });
    },
  });
}
