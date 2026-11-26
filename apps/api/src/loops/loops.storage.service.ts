import { Inject, Injectable } from "@nestjs/common";
import {
  AGENT_ID_REGEX,
  type CreateLoopInput,
  type Loop,
  LoopSchema,
  MakerRefSchema,
  type UpdateLoopInput,
  VerifierSpecSchema,
} from "@zibby/contracts";
import { MarkdownEntityStore, searchByText } from "../shared/file-storage";
import {
  CorruptLoopFileError,
  InvalidLoopError,
  InvalidLoopIdError,
  LoopConflictError,
  LoopNotFoundError,
} from "./loops.errors";

/** DI token carrying the absolute path of the directory that holds loop files. */
export const LOOPS_DIR = "LOOPS_DIR";

/**
 * File-backed persistence for loops: one `<id>.loop.md` per loop. The frontmatter
 * carries the structured config (`name`, `desc`, `objective`, `maker`, `verifier`,
 * `maxIterations`, `budget`) and the Markdown body is `instructions`. Same
 * guarantees as the agents/workflows stores — atomic writes, defense-in-depth id
 * guards, tolerant listing. A structurally-broken `maker`/`verifier` makes the
 * loop corrupt (it can't loop without them) rather than silently dropping it.
 */
@Injectable()
export class LoopsStorageService extends MarkdownEntityStore<Loop> {
  protected readonly fileExt = ".loop.md";
  protected readonly idRegex = AGENT_ID_REGEX;

  constructor(@Inject(LOOPS_DIR) dir: string) {
    super(dir);
  }

  async create(input: CreateLoopInput): Promise<Loop> {
    const file = this.resolveFile(input.id);
    if (await this.fileExists(file)) {
      throw new LoopConflictError(input.id);
    }
    const parsed = LoopSchema.safeParse({ ...input, name: input.name ?? input.id });
    if (!parsed.success) {
      throw new InvalidLoopError(parsed.error.issues[0]?.message ?? "invalid loop");
    }
    await this.writeEntity(parsed.data);
    return parsed.data;
  }

  /** Free-text search over the catalog by id, name, desc and objective. */
  async search(query: string): Promise<Loop[]> {
    return searchByText(await this.list(), query, (g) => [g.id, g.name, g.desc, g.objective]);
  }

  async update(id: string, patch: UpdateLoopInput): Promise<Loop> {
    const existing = await this.get(id);
    const candidate = { ...existing, ...patch, id: existing.id };
    const parsed = LoopSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new InvalidLoopError(parsed.error.issues[0]?.message ?? "invalid loop");
    }
    await this.writeEntity(parsed.data);
    return parsed.data;
  }

  protected idOf(loop: Loop): string {
    return loop.id;
  }

  protected notFound(id: string): Error {
    return new LoopNotFoundError(id);
  }

  protected invalidId(id: string): Error {
    return new InvalidLoopIdError(id);
  }

  protected corruptError(id: string): Error {
    return new CorruptLoopFileError(id);
  }

  protected compare(a: Loop, b: Loop): number {
    return a.id.localeCompare(b.id);
  }

  protected bodyOf(loop: Loop): string {
    return loop.instructions;
  }

  /**
   * Parse a `.loop.md` into a {@link Loop}. The id comes from the file name; the
   * structured config + maker/verifier from the frontmatter; `instructions` from
   * the body. Returns null if structurally broken (bad YAML, no valid maker chain).
   */
  protected fromFrontmatter(data: Record<string, unknown>, id: string, body: string): Loop | null {
    const candidate: Record<string, unknown> = {
      id,
      instructions: body,
      objective: data.objective,
      maxIterations: data.maxIterations,
    };
    if (typeof data.name === "string") candidate.name = data.name;
    if (typeof data.desc === "string") candidate.desc = data.desc;
    if (data.budget !== undefined) candidate.budget = data.budget;
    if (typeof data.projectId === "string") candidate.projectId = data.projectId;
    const maker = MakerRefSchema.safeParse(data.maker);
    if (maker.success) candidate.maker = maker.data;
    const verifier = VerifierSpecSchema.safeParse(data.verifier);
    if (verifier.success) candidate.verifier = verifier.data;

    const result = LoopSchema.safeParse(candidate);
    return result.success ? result.data : null;
  }

  protected toFrontmatter(loop: Loop): Record<string, unknown> {
    const data: Record<string, unknown> = {
      name: loop.name ?? loop.id,
      objective: loop.objective,
      maker: loop.maker,
      verifier: loop.verifier,
      maxIterations: loop.maxIterations,
    };
    if (loop.desc !== undefined) data.desc = loop.desc;
    if (loop.budget !== undefined) data.budget = loop.budget;
    if (loop.projectId !== undefined) data.projectId = loop.projectId;
    return data;
  }
}
