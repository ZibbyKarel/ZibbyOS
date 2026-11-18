import { z } from "zod";
import { AgentIdSchema } from "../agents/agent.schema";
import { isValidGitRemote } from "../projects/project.schema";
import { KbRelPathSchema, isAbsoluteHostPath } from "./team.schema";

export const DEFAULT_KB_ROOT = "wiki/INDEX.md";
export const DEFAULT_KB_CONTEXT = "team-context.md";

/**
 * One connected knowledge base in the mozek registry (`knowledge/knowledge-bases.md`
 * frontmatter `kbs:`). `readOnly` is a literal `true` — data, not a permission: no
 * code path writes into a KB except the gated `kb-answer` inbox flow.
 */
export const KnowledgeBaseEntrySchema = z
  .object({
    id: AgentIdSchema,
    name: z.string().min(1),
    /** Absolute host path, read in place. */
    path: z.string().min(1).refine(isAbsoluteHostPath, { message: "must be an absolute path" }),
    gitRemote: z
      .string()
      .min(1)
      .refine(isValidGitRemote, { message: "unsupported git remote" })
      .optional(),
    readOnly: z.literal(true),
    /** Entry index relative to `path`. */
    root: KbRelPathSchema.default(DEFAULT_KB_ROOT),
    /** Team-context file relative to `path`. */
    context: KbRelPathSchema.default(DEFAULT_KB_CONTEXT),
    domain: z.enum(["work", "personal"]).default("work"),
    /** One line: what questions this KB answers. */
    description: z.string().default(""),
    teamId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
  })
  .strict();
export type KnowledgeBaseEntry = z.infer<typeof KnowledgeBaseEntrySchema>;

/** Frontmatter of the registry note: `{ kbs: Entry[] }`, ids unique. */
export const KnowledgeBaseRegistrySchema = z.object({
  kbs: z
    .array(KnowledgeBaseEntrySchema)
    .refine((kbs) => new Set(kbs.map((k) => k.id)).size === kbs.length, {
      message: "duplicate knowledge base id",
    }),
});
export type KnowledgeBaseRegistry = z.infer<typeof KnowledgeBaseRegistrySchema>;
