import { z } from "zod";

/** A canvas id: 10 chars `[a-z0-9]` — subdomain-safe (`<id>.canvas.localhost`). */
export const CANVAS_ID_PATTERN = /^[a-z0-9]{10}$/;
export const CanvasIdSchema = z.string().regex(CANVAS_ID_PATTERN);
export type CanvasId = z.infer<typeof CanvasIdSchema>;

/** One immutable version of a canvas (`<id>/v<n>/index.html`). */
export const CanvasVersionSchema = z.object({
  version: z.number().int().min(1),
  at: z.string().datetime(),
  note: z.string().optional(),
});
export type CanvasVersion = z.infer<typeof CanvasVersionSchema>;

/** A canvas's `meta.json`: a small HTML page the chat agent published, versioned append-only. */
export const CanvasMetaSchema = z.object({
  id: CanvasIdSchema,
  title: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  versions: z.array(CanvasVersionSchema),
  /** The current version number (one of `versions`). */
  current: z.number().int().min(1),
});
export type CanvasMeta = z.infer<typeof CanvasMetaSchema>;
