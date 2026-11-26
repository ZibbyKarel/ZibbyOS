import { z } from "zod";
import { AgentIdSchema, AgentModelSchema, AgentThinkingSchema } from "../agents/agent.schema";
import { ProjectBudgetSchema } from "../projects/project.schema";

/**
 * The maker a loop iterates: an existing stored agent OR workflow, dispatched
 * through the same runner seam everything else uses (Phase 10 is thin glue — the
 * maker is NOT a new run kind). `id` is the agent/workflow definition id.
 */
export const MakerRefSchema = z.object({
  kind: z.enum(["agent", "workflow"]),
  id: AgentIdSchema,
});
export type MakerRef = z.infer<typeof MakerRefSchema>;

/**
 * How a loop's verifier decides "satisfied" — a spec, not a new engine:
 * - `claude`: a fresh agent run on its own (cheaper) model, handed the maker's
 *   diff/output, that returns a verdict. A separate spawn with no shared session
 *   (no session resume exists — decision 8).
 *
 * There is no shell-checks verifier: how a project verifies itself lives in that
 * project's repo, which the maker's agents run (D-024).
 */
export const VerifierSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("claude"),
    agent: AgentIdSchema,
    model: AgentModelSchema.optional(),
    thinking: AgentThinkingSchema.optional(),
  }),
]);
export type VerifierSpec = z.infer<typeof VerifierSpecSchema>;

/** The plain object form — `update` derives from this. */
const LoopObject = z.object({
  id: AgentIdSchema,
  name: z.string().min(1).optional(),
  desc: z.string().optional(),
  /** The outcome the loop is driving toward — the human loop statement. */
  objective: z.string().min(1),
  maker: MakerRefSchema,
  verifier: VerifierSpecSchema,
  /** The hard fuse: the loop parks after this many *counted* (verified) iterations. */
  maxIterations: z.number().int().positive(),
  /** Per-loop run-count budget (mirrors a project's), optional. */
  budget: ProjectBudgetSchema.optional(),
  /** Markdown body — extra standing instructions handed to each maker iteration. */
  instructions: z.string().min(1),
  /** The project this loop is scoped to (O-16), optional — a loop may stand alone. */
  projectId: z.string().optional(),
});

/**
 * A loop definition — the outer loop's recipe — stored as a `.loop.md` file
 * (frontmatter carries `maker`/`verifier`/`maxIterations`/`budget`, the Markdown
 * body is `instructions`). A parallel to a workflow definition, not a new dispatch
 * path: the maker it names is an existing agent or workflow.
 */
export const LoopSchema = LoopObject;
export type Loop = z.infer<typeof LoopSchema>;

/** Body accepted by `createLoop` — the full entity (`id` + required fields). */
export const CreateLoopSchema = LoopSchema;
export type CreateLoopInput = z.infer<typeof CreateLoopSchema>;

/** Body accepted by `updateLoop` — every field optional (partial), id excluded. */
export const UpdateLoopSchema = LoopObject.omit({ id: true }).partial();
export type UpdateLoopInput = z.infer<typeof UpdateLoopSchema>;
