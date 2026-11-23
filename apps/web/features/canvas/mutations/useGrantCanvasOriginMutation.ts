import { apiClient } from "../../../state/api";

/** Grant a manifest-declared origin to the canvas (`POST /api/canvas/:id/grants`, operator token). */
export function useGrantCanvasOriginMutation() {
  return apiClient.canvas.grantCanvasOrigin.useMutation();
}
