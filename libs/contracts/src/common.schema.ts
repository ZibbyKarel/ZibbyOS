import { z } from "zod";

/**
 * Shared error body for 4xx responses, used across multiple resource contracts
 * (agents, agent-runs, categories). Kept in a cross-domain `common` module rather
 * than any single resource's schema file so no domain has to reach into another's
 * just for the error shape.
 */
export const ErrorSchema = z.object({ message: z.string() });
export type ErrorBody = z.infer<typeof ErrorSchema>;

/**
 * An ISO 8601 date-time string (e.g. `2026-06-28T04:30:00Z`). The single shape
 * for every timestamp field across the contracts — `startedAt`, `createdAt`,
 * `lastSyncAt`, … — so the validation rule lives in one place. Chain `.optional()`
 * / `.nullable()` at the use site as before.
 */
export const IsoDateTimeSchema = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * The shared lifecycle states a run can be in, across every run kind (agent,
 * skill, workflow stage). Two *safe paused states with no live child* — each
 * survives a restart unchanged rather than being reconciled to `interrupted`:
 * - `awaiting-approval` (Phase 3): the runner created an approval and will not
 *   perform the gated action until a decision arrives.
 * - `paused-limit` (Phase 9): the run's child died on a subscription usage limit;
 *   it is a *pause, not a failure* — it does not burn retry budget, carries a
 *   persisted `resumeAt`, and auto-resumes when the window resets. Modeled on
 *   `awaiting-approval` (a stashed spawn spec gives restart survival + respawn).
 */
export const RunStatusSchema = z.enum([
  "running",
  "done",
  "error",
  "interrupted",
  "awaiting-approval",
  "paused-limit",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/**
 * Risk hint carried in agent/skill frontmatter. Display-only from Phase 3.5 on
 * (the gate policy engine decides; `risk` only colours the UI badge).
 */
export const RiskSchema = z.enum(["low", "medium", "high"]);
export type Risk = z.infer<typeof RiskSchema>;

/**
 * The git worktree a run owns (Phase 3.1). A project-targeted run works on its own
 * branch in a dedicated worktree under the run dir, never the operator's main
 * checkout: `branch` is `zibby/<runId>-<slug>`, `path` the worktree directory, and
 * `baseRef` the HEAD it was cut from (the diff base for the PR-gate diffstat).
 * Optional on the run records — a non-git (or projectless) run carries none and
 * falls back to the Phase 2 direct-checkout cwd.
 */
export const WorkspaceSchema = z.object({
  branch: z.string().min(1),
  path: z.string().min(1),
  baseRef: z.string().min(1),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/**
 * Max length of an avatar/logo data URI, the storage backstop. Sized so a 2 MB image
 * fits: 2 MB → ~2.8 M base64 chars, and we allow up to 2,900,000 for the data-URI
 * prefix + headroom. (The API body-parser limit in `main.ts` must stay above this.)
 */
export const AVATAR_MAX = 2_900_000;

/**
 * An entity avatar: either an uploaded `data:image/*` URI or a `/`-rooted path to
 * a bundled static asset (`/avatars/architect.png`). Anything else — notably an
 * external `http(s)://` URL — is rejected, so inbound data can never point the UI
 * at a fetch it shouldn't make.
 */
export const AvatarSchema = z
  .string()
  .max(AVATAR_MAX)
  .refine((v) => v.startsWith("data:image/") || (v.startsWith("/") && !v.startsWith("//")), {
    message: "avatar must be a data:image/ URI or a root-relative path",
  });

/** Max decoded size of an uploaded entity logo (company / team / project). */
export const LOGO_MAX_BYTES = 512 * 1024;

const LOGO_DATA_URI_RE = /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/;
/** SVG constructs that can run script or pull in external content. */
const UNSAFE_SVG_RE = /<script|<foreignObject|<!ENTITY|\son[a-z]+\s*=|javascript:/i;

/** Mime of `bytes` judged by magic numbers (never by the declared type), or null if not an allowed image. */
function sniffLogoMime(bytes: Uint8Array): string | null {
  const at = (i: number, sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^\uFEFF/, "");
  return /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(
    head,
  )
    ? "image/svg+xml"
    : null;
}

/**
 * Write-side validation of an uploaded entity logo: a bundled `/`-path (as
 * `AvatarSchema`) or a base64 `data:` URI whose bytes are a png/jpeg/webp/svg
 * (sniffed from content, matching the declared type), at most 512 KB, and for
 * SVG free of script / event handlers / `javascript:` / foreign content. The
 * read schema stays the lenient `AvatarSchema` so older stored logos never
 * make a record vanish from a listing. Logos travel as data URIs rendered via
 * `<img>`, so SVG scripts never execute and no separate serving route exists.
 */
export const LogoInputSchema = AvatarSchema.superRefine((value, ctx) => {
  if (value.startsWith("/")) return;
  const match = LOGO_DATA_URI_RE.exec(value);
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!match) return fail("logo must be a png, jpeg, webp or svg base64 data URI");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[2] ?? ""), (ch) => ch.charCodeAt(0));
  } catch {
    return fail("logo is not valid base64");
  }
  if (bytes.length > LOGO_MAX_BYTES) return fail("logo is larger than 512 KB");
  const sniffed = sniffLogoMime(bytes);
  if (sniffed === null || sniffed !== match[1]) return fail("logo content does not match its type");
  if (sniffed === "image/svg+xml" && UNSAFE_SVG_RE.test(new TextDecoder().decode(bytes))) {
    fail("svg logo must not contain scripts or event handlers");
  }
});

/**
 * The shared shape of a DELETE response: the deleted entity's `id`, echoed back
 * so the caller can confirm what was removed (and web mutation hooks read `.id`
 * for cache invalidation). Reused across every resource's `deleteX` route
 * instead of each contract hand-rolling its own `{ id: <IdSchema> }` literal —
 * they were already structurally identical (T11 dedup, finding #9).
 */
export const DeleteResponseSchema = z.object({ id: z.string() });
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;

/**
 * The shared "no body, or an empty object" idiom used by every action-style
 * route that takes no real input (`trigger`, `clone`, `run`, …). ts-rest still
 * wants a schema on `body` to accept a request with no `Content-Type`/empty
 * JSON object; this is that schema, reused instead of each contract repeating
 * the same `z.object({}).optional()` literal (T11 dedup, finding #37).
 */
export const EmptyBodySchema = z.object({}).optional();

/**
 * One run artifact: its name and text content. Shared by every run kind's
 * artifact endpoint (task runs, workflow runs, …) — they were already
 * byte-identical `{ name: z.string(), content: z.string() }` shapes, each
 * kind's own storage/allowlist layer still enforces which names are valid
 * (T11 dedup, finding #29).
 */
export const RunArtifactSchema = z.object({ name: z.string(), content: z.string() });
export type RunArtifact = z.infer<typeof RunArtifactSchema>;

/** One file row of a diffstat (`git diff --numstat`). */
export const DiffFileSchema = z.object({
  path: z.string().min(1),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** git numstat reports `-`/`-` for binaries — kept as a row, counted as 0/0. */
  binary: z.boolean().optional(),
});
export type DiffFile = z.infer<typeof DiffFileSchema>;

/** A structured diffstat: per-file rows plus the totals. */
export const DiffstatSchema = z.object({
  files: z.array(DiffFileSchema),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});
export type Diffstat = z.infer<typeof DiffstatSchema>;
