import { initContract } from "@ts-rest/core";
import { ErrorSchema } from "../common.schema";
import { CanvasMetaSchema } from "./canvas.schema";

const c = initContract();

/**
 * Canvas: READ-ONLY access to a published canvas's metadata. Canvases are born only
 * inside the API (the chat `publish_canvas` tool writes them); the HTML itself is
 * served by the separate canvas listener, never through this contract.
 */
export const canvasContract = c.router(
  {
    getCanvas: {
      method: "GET",
      path: "/canvas/:id",
      responses: { 200: CanvasMetaSchema, 404: ErrorSchema },
      summary: "One canvas's metadata by id",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type CanvasContract = typeof canvasContract;
