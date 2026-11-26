import { Module } from "@nestjs/common";
import { ApprovalsModule } from "../approvals/approvals.module";
import { BudgetModule } from "../budget/budget.module";
import { ProjectsModule } from "../projects/projects.module";
import { ScheduledTasksStorageModule } from "../tasks/scheduled-tasks-storage.module";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService } from "./goal-engine.service";
import { GOAL_FACTS_SOURCES, GoalFactsService, TaskFactsSource } from "./goal-facts";
import { EmptyGoalPlanner, GOAL_PLANNER } from "./goal-planner";
import { GoalsModule } from "./goals.module";

/**
 * The goal engine, apart from {@link GoalsModule} so the briefing and the events channel
 * can import the goal stores without pulling the engine's dependencies (budget, tasks).
 * Add a facts source to the {@link GOAL_FACTS_SOURCES} factory; replace the
 * {@link GOAL_PLANNER} provider with the real planner.
 */
@Module({
  imports: [
    GoalsModule,
    ProjectsModule,
    ScheduledTasksStorageModule,
    BudgetModule,
    ApprovalsModule,
  ],
  providers: [
    TaskFactsSource,
    {
      provide: GOAL_FACTS_SOURCES,
      useFactory: (tasks: TaskFactsSource) => [tasks],
      inject: [TaskFactsSource],
    },
    GoalFactsService,
    { provide: GOAL_PLANNER, useClass: EmptyGoalPlanner },
    GoalActionExecutor,
    GoalEngineService,
  ],
  exports: [GoalActionExecutor, GoalEngineService],
})
export class GoalEngineModule {}
