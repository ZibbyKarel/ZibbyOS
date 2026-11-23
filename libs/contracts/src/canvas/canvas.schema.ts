import { z } from "zod";

/** A canvas id: 10 chars `[a-z0-9]` — subdomain-safe (`<id>.canvas.localhost`). */
export const CANVAS_ID_PATTERN = /^[a-z0-9]{10}$/;
export const CanvasIdSchema = z.string().regex(CANVAS_ID_PATTERN);
export type CanvasId = z.infer<typeof CanvasIdSchema>;

const ParamValueSchema = z.union([z.number(), z.string().max(500), z.boolean()]);

/** One tweakable parameter a page declares in its manifest. */
export const CanvasParamSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/),
  label: z.string().min(1).max(60),
  type: z.enum(["number", "text", "boolean", "select"]),
  unit: z.string().max(12).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  /** `select` only. */
  options: z.array(z.string().min(1).max(60)).max(30).optional(),
  /** The default value. */
  value: ParamValueSchema,
});
export type CanvasParam = z.infer<typeof CanvasParamSchema>;

/** Param id → value. */
export const CanvasParamValuesSchema = z.record(z.string(), ParamValueSchema);
export type CanvasParamValues = z.infer<typeof CanvasParamValuesSchema>;

/** The optional `<script type="application/zibby+json">` manifest of a page. */
export const CanvasManifestSchema = z.object({
  params: z.array(CanvasParamSchema).max(40).default([]),
  /** https origins only, normalised to `new URL(x).origin` so store, proxy and web compare one string. */
  net: z
    .array(
      z
        .string()
        .url()
        .refine((u) => u.startsWith("https://"), "https only")
        .transform((u) => new URL(u).origin),
    )
    .max(10)
    .default([]),
});
export type CanvasManifest = z.infer<typeof CanvasManifestSchema>;

/** One immutable version: `code` (`<id>/v<n>/index.html`) or `params` (meta only, applies to `base`). */
export const CanvasVersionSchema = z.object({
  version: z.number().int().min(1),
  at: z.string().datetime(),
  note: z.string().optional(),
  kind: z.enum(["code", "params"]).default("code"),
  /** params only: the code version these values apply to. */
  base: z.number().int().min(1).optional(),
  /** params only: the COMPLETE effective values. */
  params: CanvasParamValuesSchema.optional(),
  /** code only, when the page has a manifest. */
  manifest: CanvasManifestSchema.optional(),
  by: z.enum(["agent", "operator"]).optional(),
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

/** Proxied text response of `canvasFetch`. */
export const CanvasFetchResultSchema = z.object({
  status: z.number().int(),
  contentType: z.string(),
  body: z.string(),
});
export type CanvasFetchResult = z.infer<typeof CanvasFetchResultSchema>;

export const CanvasFetchDeniedSchema = z.object({
  error: z.enum(["not-allowed", "needs-grant", "blocked"]),
  origin: z.string(),
});
export type CanvasFetchDenied = z.infer<typeof CanvasFetchDeniedSchema>;
