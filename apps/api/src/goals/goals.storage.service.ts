import { Inject, Injectable } from "@nestjs/common";
import {
  AGENT_ID_REGEX,
  CLEARABLE_GOAL_FIELDS,
  type CreateGoalInput,
  type Goal,
  GoalSchema,
  type UpdateGoalInput,
} from "@zibby/contracts";
import { MarkdownEntityStore } from "../shared/file-storage";
import {
  CorruptGoalFileError,
  GoalConflictError,
  GoalNotFoundError,
  InvalidGoalError,
  InvalidGoalIdError,
} from "./goals.errors";

/** DI token carrying the absolute path of the directory that holds goal files. */
export const GOALS_DIR = "GOALS_DIR";

/**
 * One `<id>.goal.md` per goal: frontmatter = every field except `outcome` (and the
 * id, which is the file name); the body is `outcome`. Runtime state lives in the
 * `state/` subfolder, which this store never reads (it lists `*.goal.md` only).
 */
@Injectable()
export class GoalsStorageService extends MarkdownEntityStore<Goal> {
  protected readonly fileExt = ".goal.md";
  protected readonly idRegex = AGENT_ID_REGEX;

  constructor(@Inject(GOALS_DIR) dir: string) {
    super(dir);
  }

  async create(input: CreateGoalInput): Promise<Goal> {
    const now = new Date().toISOString();
    const parsed = GoalSchema.safeParse({ ...input, createdAt: now, updatedAt: now });
    if (!parsed.success) {
      throw new InvalidGoalError(parsed.error.issues[0]?.message ?? "invalid goal");
    }
    const created = await this.createEntity(parsed.data.id, () => parsed.data);
    if (!created) throw new GoalConflictError(input.id);
    return created;
  }

  async update(id: string, patch: UpdateGoalInput): Promise<Goal> {
    return this.updateEntity(id, (existing) => {
      // `null` clears an optional field (JSON has no undefined); the merge is then validated whole.
      const merged: Record<string, unknown> = { ...existing, ...patch };
      for (const key of CLEARABLE_GOAL_FIELDS) if (merged[key] === null) delete merged[key];
      const parsed = GoalSchema.safeParse({
        ...merged,
        id: existing.id,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) {
        throw new InvalidGoalError(parsed.error.issues[0]?.message ?? "invalid goal");
      }
      return parsed.data;
    });
  }

  protected idOf(goal: Goal): string {
    return goal.id;
  }
  protected notFound(id: string): Error {
    return new GoalNotFoundError(id);
  }
  protected invalidId(id: string): Error {
    return new InvalidGoalIdError(id);
  }
  protected corruptError(id: string): Error {
    return new CorruptGoalFileError(id);
  }
  protected compare(a: Goal, b: Goal): number {
    return a.id.localeCompare(b.id);
  }
  protected bodyOf(goal: Goal): string {
    return goal.outcome;
  }

  protected toFrontmatter(goal: Goal): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(goal).filter(([k, v]) => k !== "id" && k !== "outcome" && v !== undefined),
    );
  }

  protected fromFrontmatter(data: Record<string, unknown>, id: string, body: string): Goal | null {
    const result = GoalSchema.safeParse({ ...data, id, outcome: body });
    return result.success ? result.data : null;
  }
}
