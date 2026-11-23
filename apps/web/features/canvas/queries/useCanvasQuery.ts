import { apiClient } from "../../../state/api";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";

/** Shared cache key for one canvas's metadata; exported so mutations can invalidate it. */
export function getCanvasQueryKey(id: string) {
  return ["canvas", id] as const;
}

/** One canvas's metadata + versions (`GET /api/canvas/:id`). */
export function useCanvasQuery(id: string | null) {
  return apiClient.canvas.getCanvas.useQuery({
    queryKey: getCanvasQueryKey(id ?? ""),
    queryData: { params: { id: id ?? "" } },
    enabled: Boolean(id),
    select: selectApiResponseBody,
  });
}
