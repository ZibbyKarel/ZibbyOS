import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import {
  CreateGoalSchema,
  type Goal,
  type GoalStateView,
  MERGE_GRANT_MAX_HOURS,
  SetMergeGrantSchema,
  UpdateGoalSchema,
  goalsContract,
  rollupGoal,
} from "@zibby/contracts";
import { hasOperatorToken } from "../approvals/operator-token.guard";
import { OperatorTokenService } from "../approvals/operator-token.service";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { makeErrorMapper } from "../shared/http/error-mapping";
import { GoalStateStore } from "./goal-state.store";
import {
  GoalConflictError,
  GoalInstanceNotFoundError,
  GoalInstanceNotParkedError,
  GoalNotFoundError,
  InvalidGoalError,
  InvalidGoalIdError,
} from "./goals.errors";
import { GoalsStorageService } from "./goals.storage.service";

const errors = makeErrorMapper("Goal", {
  missing: [GoalNotFoundError, InvalidGoalIdError, GoalInstanceNotFoundError],
  conflict: [GoalConflictError],
});

const invalid = (error: unknown) =>
  error instanceof InvalidGoalError
    ? ({ status: 422, body: { message: error.message } } as const)
    : undefined;

/** Strict parse failure (unknown key such as `mergeGrant`, or a bad combination). */
const unprocessable = (message = "invalid goal") => ({ status: 422, body: { message } }) as const;

const notParked = (error: unknown) =>
  error instanceof GoalInstanceNotParkedError
    ? ({ status: 409, body: { message: error.message } } as const)
    : undefined;

const NO_TOKEN = {
  status: 401,
  body: { message: "Setting or revoking a merge grant requires the operator token." },
} as const;

/**
 * Implements `goalsContract`: definitions via the storage service, state via the state store.
 * The merge grant is written only by `setGoalMergeGrant` / `clearGoalMergeGrant`, both behind
 * the operator token (the same check as the Autopilot raise/resume).
 */
@Controller()
export class GoalsController {
  constructor(
    private readonly storage: GoalsStorageService,
    private readonly states: GoalStateStore,
    private readonly tokens: OperatorTokenService,
    private readonly projects: ProjectsStorageService,
  ) {}

  /** Why a grant cannot be set on `goal`, or null (ceiling tier3, until ≤ 24 h, projects in scope). */
  private async grantIssue(
    goal: Goal,
    projectIds: string[],
    until: string,
  ): Promise<string | null> {
    if (goal.ceiling !== "tier3") return "a merge grant needs the goal's ceiling tier3";
    const end = Date.parse(until);
    const now = Date.now();
    if (!(end > now)) return "until must be in the future";
    if (end > now + MERGE_GRANT_MAX_HOURS * 3_600_000) {
      return `until must be at most ${MERGE_GRANT_MAX_HOURS} h ahead`;
    }
    const scope = goal.scope;
    let allowed: Set<string>;
    if (scope.kind === "none") return "the goal is not tied to a project";
    else if (scope.kind === "projects") allowed = new Set(scope.projectIds);
    else {
      const all = await this.projects.list();
      allowed = new Set(
        all.filter((p) => scope.kind === "all" || p.companyId === scope.companyId).map((p) => p.id),
      );
    }
    const outside = projectIds.filter((id) => !allowed.has(id));
    return outside.length ? `outside the goal's scope: ${outside.join(", ")}` : null;
  }

  private async view(goal: Goal, state?: Awaited<ReturnType<GoalStateStore["read"]>>) {
    const s = state ?? (await this.states.read(goal.id, goal.createdAt));
    return { state: s, rollup: rollupGoal(goal, s) } satisfies GoalStateView;
  }

  @TsRestHandler(goalsContract)
  handler() {
    return tsRestHandler(goalsContract, {
      createGoal: async ({ body }) => {
        const parsed = CreateGoalSchema.safeParse(body);
        if (!parsed.success) return unprocessable(parsed.error.issues[0]?.message);
        return errors.created(() => this.storage.create(parsed.data), invalid);
      },

      listGoals: async () => {
        const goals = await this.storage.list();
        const body = await Promise.all(
          goals.map(async (goal) => ({ ...goal, rollup: (await this.view(goal)).rollup })),
        );
        return { status: 200, body } as const;
      },

      getGoal: ({ params: { id } }) => errors.or404(id, () => this.storage.get(id)),

      updateGoal: async ({ params: { id }, body }) => {
        const parsed = UpdateGoalSchema.safeParse(body);
        if (!parsed.success) return unprocessable(parsed.error.issues[0]?.message);
        return errors.or404(id, () => this.storage.update(id, parsed.data), invalid);
      },

      deleteGoal: ({ params: { id } }) =>
        errors.or404(id, async () => {
          await this.storage.delete(id);
          await this.states.remove(id);
          return { id };
        }),

      getGoalState: ({ params: { id } }) =>
        errors.or404(id, async () => this.view(await this.storage.get(id))),

      getGoalTimeline: ({ params: { id }, query }) =>
        errors.or404(id, async () => {
          await this.storage.get(id);
          return this.states.timeline(id, query);
        }),

      wakeGoal: ({ params: { id } }) =>
        errors.or404(id, async () => {
          const goal = await this.storage.get(id);
          return this.view(goal, await this.states.wake(id, goal.createdAt));
        }),

      setGoalMergeGrant: async ({ params: { id }, body, headers }) => {
        if (!hasOperatorToken(this.tokens, headers)) return NO_TOKEN;
        const parsed = SetMergeGrantSchema.safeParse(body);
        if (!parsed.success) return unprocessable(parsed.error.issues[0]?.message);
        const { projectIds, until } = parsed.data;
        return errors.or404(
          id,
          async () => {
            const issue = await this.grantIssue(await this.storage.get(id), projectIds, until);
            if (issue) throw new InvalidGoalError(issue);
            return this.storage.setMergeGrant(id, {
              projectIds: [...new Set(projectIds)],
              until: new Date(Date.parse(until)).toISOString(),
              grantedAt: new Date().toISOString(),
            });
          },
          invalid,
        );
      },

      clearGoalMergeGrant: async ({ params: { id }, headers }) => {
        if (!hasOperatorToken(this.tokens, headers)) return NO_TOKEN;
        return errors.or404(id, () => this.storage.setMergeGrant(id, undefined));
      },

      resumeGoalInstance: ({ params: { id, instance } }) =>
        errors.or404(
          id,
          async () => {
            const goal = await this.storage.get(id);
            return this.view(goal, await this.states.resume(id, instance, goal.createdAt));
          },
          notParked,
        ),
    });
  }
}
