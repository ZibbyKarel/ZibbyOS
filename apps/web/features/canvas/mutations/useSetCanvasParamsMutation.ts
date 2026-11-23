import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../state/api";
import { getCanvasQueryKey } from "../queries/useCanvasQuery";

/** Set parameter values (`POST /api/canvas/:id/params`); refreshes the canvas metadata. */
export function useSetCanvasParamsMutation() {
  const queryClient = useQueryClient();
  return apiClient.canvas.setCanvasParams.useMutation({
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: getCanvasQueryKey(variables.params.id) });
    },
  });
}
