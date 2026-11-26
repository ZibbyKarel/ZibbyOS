import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import { CreateLoopSchema, LoopSchema, UpdateLoopSchema } from "./loop.schema";

const c = initContract();

const LoopIdParam = z.object({ id: z.string().min(1) });

/** The names a loop run artifact may have — the allowlist the artifact endpoint enforces. */
export const LOOP_RUN_ARTIFACTS = ["objective.md", "verdict.txt", "resume-context.md"] as const;

/** One whitelisted loop run artifact: its name and its text content. */
export const LoopRunArtifactSchema = z.object({
  name: z.enum(LOOP_RUN_ARTIFACTS),
  content: z.string(),
});
export type LoopRunArtifact = z.infer<typeof LoopRunArtifactSchema>;

/** CRUD over loop definitions (`.loop.md` files). Mirrors `agentsContract`/`workflowsContract`. */
export const loopsContract = c.router(
  {
    createLoop: {
      method: "POST",
      path: "/loops",
      body: CreateLoopSchema,
      responses: { 201: LoopSchema, 409: ErrorSchema, 422: ErrorSchema },
      summary: "Create a new loop",
    },
    listLoops: {
      method: "GET",
      path: "/loops",
      responses: { 200: z.array(LoopSchema) },
      summary: "List all loops",
    },
    getLoop: {
      method: "GET",
      path: "/loops/:id",
      pathParams: LoopIdParam,
      responses: { 200: LoopSchema, 404: ErrorSchema },
      summary: "Get a single loop by id",
    },
    updateLoop: {
      method: "PATCH",
      path: "/loops/:id",
      pathParams: LoopIdParam,
      body: UpdateLoopSchema,
      responses: { 200: LoopSchema, 404: ErrorSchema, 422: ErrorSchema },
      summary: "Partially update an existing loop",
    },
    deleteLoop: {
      method: "DELETE",
      path: "/loops/:id",
      pathParams: LoopIdParam,
      responses: { 200: z.object({ id: z.string() }), 404: ErrorSchema },
      summary: "Delete a loop",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type LoopsContract = typeof loopsContract;

// Loop execution has no per-kind HTTP surface: a loop run is started only by
// creating a task (`POST /api/tasks` with a `loop` target), and every run
// operation (detail, logs, resume, delete, artifacts) lives on the unified
// `taskRuns` contract under `/api/tasks/runs/*`. The `LOOP_RUN_ARTIFACTS`
// allowlist above is still the server-side guard the unified artifact endpoint
// enforces. There is intentionally no `loopRunsContract`.
