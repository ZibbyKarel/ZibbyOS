import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import {
  CreateGoalSchema,
  type Goal,
  type GoalStateView,
  UpdateGoalSchema,
  goalsContract,
  rollupGoal,
} from "@zibby/contracts";
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

/** Implements `goalsContract`: definitions via the storage service, state via the state store. */
@Controller()
export class GoalsController {
  constructor(
    private readonly storage: GoalsStorageService,
    private readonly states: GoalStateStore,
  ) {}

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
