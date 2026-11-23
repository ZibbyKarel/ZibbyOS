import { apiClient } from "../../../state/api";

/** Fetch a text URL on the canvas's behalf (`POST /api/canvas/:id/fetch`). */
export function useCanvasFetchMutation() {
  return apiClient.canvas.canvasFetch.useMutation();
}
