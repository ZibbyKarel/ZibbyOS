import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../state/api";
import { getCanvasQueryKey } from "../queries/useCanvasQuery";

/** Append a copy of a version as the new current one (`POST /api/canvas/:id/restore`). */
export function useRestoreCanvasVersionMutation() {
  const queryClient = useQueryClient();
  return apiClient.canvas.restoreCanvasVersion.useMutation({
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: getCanvasQueryKey(variables.params.id) });
    },
  });
}
