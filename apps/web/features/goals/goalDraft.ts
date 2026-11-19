import type {
  AgentModel,
  AgentThinking,
  CreateGoalInput,
  Goal,
  UpdateGoalInput,
} from "@zibby/contracts";

/** The editable form state of a goal — shared by the create page and the detail's edit mode. */
export interface GoalDraft {
  name: string;
  objective: string;
  projectId: string;
  makerKind: "agent" | "workflow";
  makerId: string;
  verifierAgent: string;
  verifierModel: AgentModel | "";
  verifierThinking: AgentThinking | "";
  maxIterations: number | null;
  dailyRuns: number | null;
  weeklyRuns: number | null;
  monthlyCostCapUsd: number | null;
  instructions: string;
}

export const EMPTY_DRAFT: GoalDraft = {
  name: "",
  objective: "",
  projectId: "",
  makerKind: "agent",
  makerId: "",
  verifierAgent: "",
  verifierModel: "",
  verifierThinking: "",
  maxIterations: 8,
  dailyRuns: null,
  weeklyRuns: null,
  monthlyCostCapUsd: null,
  instructions: "",
};

export function draftFromGoal(goal: Goal): GoalDraft {
  return {
    name: goal.name ?? "",
    objective: goal.objective,
    projectId: goal.projectId ?? "",
    makerKind: goal.maker.kind,
    makerId: goal.maker.id,
    verifierAgent: goal.verifier.agent,
    verifierModel: goal.verifier.model ?? "",
    verifierThinking: goal.verifier.thinking ?? "",
    maxIterations: goal.maxIterations,
    dailyRuns: goal.budget?.dailyRuns ?? null,
    weeklyRuns: goal.budget?.weeklyRuns ?? null,
    monthlyCostCapUsd: goal.budget?.monthlyCostCapUsd ?? null,
    instructions: goal.instructions,
  };
}

/** A draft can be saved: objective, maker, verifier and a positive iteration fuse are present. */
export function isDraftValid(d: GoalDraft): boolean {
  return (
    d.objective.trim().length > 0 &&
    d.makerId !== "" &&
    d.verifierAgent !== "" &&
    d.maxIterations !== null &&
    Number.isInteger(d.maxIterations) &&
    d.maxIterations > 0
  );
}

function budgetOf(d: GoalDraft): Goal["budget"] {
  const budget = {
    ...(d.dailyRuns ? { dailyRuns: d.dailyRuns } : {}),
    ...(d.weeklyRuns ? { weeklyRuns: d.weeklyRuns } : {}),
    ...(d.monthlyCostCapUsd ? { monthlyCostCapUsd: d.monthlyCostCapUsd } : {}),
  };
  return Object.keys(budget).length > 0 ? budget : undefined;
}

/** The PATCH body of an edited goal (everything the form owns; an emptied optional field is cleared). */
export function draftToUpdate(d: GoalDraft): UpdateGoalInput {
  const objective = d.objective.trim();
  return {
    name: d.name.trim() || undefined,
    objective,
    projectId: d.projectId || undefined,
    maker: { kind: d.makerKind, id: d.makerId },
    verifier: {
      kind: "claude",
      agent: d.verifierAgent,
      ...(d.verifierModel ? { model: d.verifierModel } : {}),
      ...(d.verifierThinking ? { thinking: d.verifierThinking } : {}),
    },
    maxIterations: d.maxIterations ?? 1,
    budget: budgetOf(d),
    // `instructions` is required (min 1) — fall back to the objective, like the Loop dialog.
    instructions: d.instructions.trim() || objective,
  };
}

export function draftToCreate(d: GoalDraft, id: string): CreateGoalInput {
  return { id, ...draftToUpdate(d) } as CreateGoalInput;
}
