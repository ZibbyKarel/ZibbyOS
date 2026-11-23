import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import {
  CanvasFetchDeniedSchema,
  CanvasFetchResultSchema,
  CanvasMetaSchema,
  CanvasParamValuesSchema,
} from "./canvas.schema";

const c = initContract();

/**
 * Canvas: metadata, parameter versions, restore, network grants and the fetch proxy.
 * Canvases are born only inside the API (the chat `publish_canvas` tool writes them);
 * the HTML itself is served by the separate canvas listener, never through this contract.
 * `grants` needs the operator token (401 otherwise).
 */
export const canvasContract = c.router(
  {
    getCanvas: {
      method: "GET",
      path: "/canvas/:id",
      responses: { 200: CanvasMetaSchema, 404: ErrorSchema },
      summary: "One canvas's metadata by id",
    },
    setCanvasParams: {
      method: "POST",
      path: "/canvas/:id/params",
      body: z.object({ params: CanvasParamValuesSchema, note: z.string().optional() }),
      responses: { 200: CanvasMetaSchema, 400: ErrorSchema, 404: ErrorSchema },
      summary: "Set parameter values (appends or coalesces a params version)",
    },
    restoreCanvasVersion: {
      method: "POST",
      path: "/canvas/:id/restore",
      body: z.object({ version: z.number().int().min(1) }),
      responses: { 200: CanvasMetaSchema, 404: ErrorSchema },
      summary: "Append a copy of a version as the new current one",
    },
    grantCanvasOrigin: {
      method: "POST",
      path: "/canvas/:id/grants",
      body: z.object({ origin: z.string() }),
      responses: {
        200: z.object({ grants: z.array(z.string()) }),
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
      summary: "Grant a manifest-declared origin to the canvas (operator token)",
    },
    canvasFetch: {
      method: "POST",
      path: "/canvas/:id/fetch",
      body: z.object({ url: z.string().url() }),
      responses: {
        200: CanvasFetchResultSchema,
        403: CanvasFetchDeniedSchema,
        404: ErrorSchema,
        502: ErrorSchema,
      },
      summary: "Fetch a text URL on the canvas's behalf (allow-listed, granted, SSRF-guarded)",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type CanvasContract = typeof canvasContract;
