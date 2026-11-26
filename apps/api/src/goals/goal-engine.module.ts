import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { BudgetModule } from "../budget/budget.module";
import { ChannelsModule } from "../channels/channels.module";
import { InboxModule } from "../inbox/inbox.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MemoryModule } from "../memory/memory.module";
import { ProjectsModule } from "../projects/projects.module";
import { ResolvedProjectModule } from "../projects/resolved-project.module";
import { ScheduledTasksStorageModule } from "../tasks/scheduled-tasks-storage.module";
import { TasksModule } from "../tasks/tasks.module";
import { TeamsModule } from "../teams/teams.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { GoalActionExecutor } from "./goal-action-executor";
import { GoalEngineService } from "./goal-engine.service";
import { GOAL_FACTS_SOURCES, GoalFactsService, TaskFactsSource } from "./goal-facts";
import { ApprovalFactsSource, PrFactsSource, ReplyFactsSource } from "./goal-facts-sources";
import { GOAL_PLANNER } from "./goal-planner";
import { GoalMessageService } from "./goal-message.service";
import { GoalPlannerService } from "./goal-planner.service";
import { GoalWorkHandlers } from "./goal-work-handlers";
import { GoalsModule } from "./goals.module";

/**
 * The goal engine, apart from {@link GoalsModule} so the briefing and the events channel
 * can import the goal stores without pulling the engine's dependencies (budget, tasks).
 * Add a facts source to the {@link GOAL_FACTS_SOURCES} factory. The planner is
 * {@link GoalPlannerService} (one model run through the agent runner) behind {@link GOAL_PLANNER}.
 */
@Module({
  imports: [
    GoalsModule,
    ProjectsModule,
    ScheduledTasksStorageModule,
    BudgetModule,
    ApprovalsModule,
    AgentsModule,
    MemoryModule,
    // The work-starting handlers and the wake sources (none of these import the engine).
    TasksModule,
    InboxModule,
    ChannelsModule,
    TeamsModule,
    WorkflowsModule,
    ResolvedProjectModule,
    // The `message` action: Slack accounts, their credentials and the outbound adapter.
    IntegrationsModule,
  ],
  providers: [
    TaskFactsSource,
    PrFactsSource,
    ApprovalFactsSource,
    ReplyFactsSource,
    {
      provide: GOAL_FACTS_SOURCES,
      useFactory: (
        tasks: TaskFactsSource,
        prs: PrFactsSource,
        approvals: ApprovalFactsSource,
        replies: ReplyFactsSource,
        messages: GoalMessageService,
      ) => [tasks, prs, approvals, replies, messages],
      inject: [
        TaskFactsSource,
        PrFactsSource,
        ApprovalFactsSource,
        ReplyFactsSource,
        GoalMessageService,
      ],
    },
    GoalFactsService,
    { provide: GOAL_PLANNER, useClass: GoalPlannerService },
    GoalActionExecutor,
    GoalWorkHandlers,
    GoalMessageService,
    GoalEngineService,
  ],
  exports: [GoalActionExecutor, GoalEngineService],
})
export class GoalEngineModule {}
