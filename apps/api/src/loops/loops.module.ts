import { Module } from "@nestjs/common";
import { ActivityLogModule } from "../activity/activity-log.module";
import { AgentsModule } from "../agents/agents.module";
import { BudgetModule } from "../budget/budget.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { ProjectsModule } from "../projects/projects.module";
import { WorkspaceModule } from "../workspace/workspace.module";
import { dataDir } from "../shared/data-dir";
import { LOOP_RUNS_DIR, LoopRunnerService } from "./loop-runner.service";
import { LoopsController } from "./loops.controller";
import { LOOPS_DIR, LoopsStorageService } from "./loops.storage.service";

/** Default loops dir, anchored to `apps/api/data/loops` like agents/workflows. */
export function resolveLoopsDir(): string {
  return process.env.LOOPS_DIR ?? dataDir("loops");
}

/** Default directory for loop run artifacts (per-run roots with the worktree + iteration logs). */
export function resolveLoopRunsDir(): string {
  return process.env.LOOP_RUNS_DIR ?? dataDir("loops", "runs");
}

@Module({
  // AgentsModule + WorkflowsModule export their runners — the loop's maker is one
  // of them, dispatched verbatim (the inner loop). Workspace backs the per-run
  // worktree; Projects resolves the target project for cwd + budget attribution.
  imports: [
    AgentsModule,
    WorkflowsModule,
    ProjectsModule,
    WorkspaceModule,
    BudgetModule,
    ActivityLogModule,
  ],
  // Loop runs have no per-kind HTTP surface — a loop is run only by creating a
  // task, and every run operation lives on the unified `/api/tasks/runs/*`.
  controllers: [LoopsController],
  providers: [
    { provide: LOOPS_DIR, useFactory: resolveLoopsDir },
    { provide: LOOP_RUNS_DIR, useFactory: resolveLoopRunsDir },
    LoopsStorageService,
    LoopRunnerService,
  ],
  exports: [LoopsStorageService, LoopRunnerService],
})
export class LoopsModule {}
