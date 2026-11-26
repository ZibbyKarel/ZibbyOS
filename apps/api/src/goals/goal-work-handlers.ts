import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { AutomationToggles, GoalAction, TaskTarget } from "@zibby/contracts";
import { AgentsStorageService } from "../agents/agents.storage.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { InboxAddressCommentsService } from "../inbox/inbox-address-comments.service";
import { InboxFixCiService } from "../inbox/inbox-fix-ci.service";
import { InboxReviewService } from "../inbox/inbox-review.service";
import {
  isFresh,
  prLocationOf,
  runsOf,
  teamsOfPr,
  wantsAddressing,
  wantsReview,
} from "../inbox/pr-automation.service";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { ResolvedProjectService } from "../projects/resolved-project.service";
import { ScheduledTasksStorageService } from "../tasks/scheduled-tasks.storage.service";
import { TaskSchedulerService } from "../tasks/task-scheduler.service";
import { TeamsStorageService } from "../teams/teams.storage.service";
import { WorkflowsStorageService } from "../workflows/workflows.storage.service";
import { type GoalActionContext, GoalActionExecutor, reportFromGoal } from "./goal-action-executor";
import { PrFactsSource } from "./goal-facts-sources";

type PrAction = Extract<GoalAction, { type: "pr-action" }>;

/** The Autopilot automation toggle that lets each PR op start on its own at a place. */
const PR_OP_TOGGLE: Record<PrAction["op"], keyof AutomationToggles> = {
  review: "autoReview",
  "address-comments": "autoAddressComments",
  "fix-ci": "autoFixCi",
};

/**
 * The goal engine's work-starting actions (spec "Closed action set"): `start-task`,
 * `run-loop` and `pr-action`. The ceiling, the budget and the `actionId` skip are applied
 * by {@link GoalActionExecutor} before a handler runs, and a handler that throws becomes a
 * report there. Every handler records the started task with its `actionId` in one write.
 *
 * - `start-task` / `run-loop` go through `TaskSchedulerService.createTask` like any task (gates,
 *   limits, approvals and the delivery loop apply), in the instance's project (a `_` instance:
 *   no project at all), stamped `source: "goal"` + `goalId`.
 * - `pr-action` runs only on a PR in the inbox, inside the instance's scope, on a PR that op's
 *   toggle covers (`wantsReview` / `wantsAddressing` / my own for CI, a fresh head) and only
 *   where the place's Autopilot automation toggle starts that op on its own (as
 *   `PrAutomationService` checks); otherwise it is a report. The goal's ceiling never raises
 *   a level.
 */
@Injectable()
export class GoalWorkHandlers implements OnModuleInit {
  constructor(
    private readonly executor: GoalActionExecutor,
    private readonly scheduler: TaskSchedulerService,
    private readonly agents: AgentsStorageService,
    private readonly workflows: WorkflowsStorageService,
    private readonly prs: PrFactsSource,
    private readonly reviews: InboxReviewService,
    private readonly addressComments: InboxAddressCommentsService,
    private readonly fixCi: InboxFixCiService,
    private readonly autopilot: AutopilotService,
    private readonly projects: ProjectsStorageService,
    private readonly resolvedProjects: ResolvedProjectService,
    private readonly teams: TeamsStorageService,
    private readonly tasks: ScheduledTasksStorageService,
  ) {}

  onModuleInit(): void {
    this.executor.register("start-task", async (a, ctx) => {
      const target = a.targetId ? await this.catalogTarget(a.targetId) : undefined;
      if (a.targetId && !target) {
        ctx.timeline(
          "note",
          `Target ${a.targetId} does not exist; the task is routed by its text.`,
        );
      }
      await this.startTask(ctx, a.actionId, a.text, a.title, target);
    });
    this.executor.register("run-loop", async (a, ctx) => {
      const loop = ctx.goal.loop;
      if (!loop) return reportFromGoal(ctx, "Not done: run-loop — the goal has no loop.");
      await this.startTask(ctx, a.actionId, a.text, undefined, {
        kind: "loop",
        id: loop.loopId,
        name: loop.loopId,
      });
    });
    this.executor.register("pr-action", (a, ctx) => this.prAction(a, ctx));
  }

  private async startTask(
    ctx: GoalActionContext,
    actionId: string,
    text: string,
    title: string | undefined,
    target: TaskTarget | undefined,
  ): Promise<void> {
    const { task } = await this.scheduler.createTask(
      { text, ...(title ? { title } : {}), source: "goal", goalId: ctx.goal.id },
      Date.now(),
      // `_` instance → explicitly no project: its text must not pick one by naming it.
      ctx.projectId ?? null,
      target,
      false,
    );
    await ctx.recordTask(task.id, actionId);
    ctx.timeline("task-started", `Started task ${task.id} (${actionId}).`, { taskId: task.id });
    ctx.activity("goal-acted", `${ctx.label}: started task ${task.title || actionId}`, {
      taskId: task.id,
      action: target?.kind === "loop" ? "run-loop" : "start-task",
    });
  }

  /** An explicit target the planner named, only when that agent or workflow exists. */
  private async catalogTarget(id: string): Promise<TaskTarget | undefined> {
    const agent = await this.agents.get(id).catch(() => null);
    if (agent) return { kind: "agent", id: agent.id, name: agent.name ?? agent.id };
    const workflow = await this.workflows.get(id).catch(() => null);
    if (workflow) return { kind: "workflow", id: workflow.id, name: workflow.name ?? workflow.id };
    return undefined;
  }

  private async prAction(a: PrAction, ctx: GoalActionContext): Promise<void> {
    const ref = `${a.repo}#${a.number}`;
    const notDone = (why: string) =>
      reportFromGoal(ctx, `Not done: pr-action ${a.op} ${ref} — ${why}.`);
    const pr = (await this.prs.current()).find(
      (p) =>
        p.projectId === a.projectId &&
        p.repo.toLowerCase() === a.repo.toLowerCase() &&
        p.number === a.number,
    );
    if (!pr) return notDone("not in the PR inbox");
    // Scope: a project instance acts only in its project (the service also checks the repo);
    // a `_` instance only on one of the operator's own PRs. The planner cannot widen it.
    const inScope = ctx.projectId ? a.projectId === ctx.projectId : pr.bucket === "mine";
    if (!inScope) return notDone("outside the goal's scope");
    // Eligibility: the PRs each Autopilot toggle covers, exactly as PrAutomationService checks
    // them — the toggle is not a blanket permission for any PR.
    if (a.op === "review" || a.op === "address-comments") {
      const eligible = a.op === "review" ? wantsReview(pr) && !!pr.headSha : wantsAddressing(pr);
      if (!eligible) return notDone("this PR is not one Autopilot does that for");
      const runs = runsOf(await this.tasks.list(), (t) =>
        a.op === "review" ? t.prReview : t.prAddressComments,
      );
      if (!isFresh(pr, runs)) return notDone("already done or running for this head");
    } else if (pr.bucket !== "mine") {
      return notDone("CI is fixed only on the operator's own PRs");
    }
    const teamIds = teamsOfPr(pr, await this.teams.list().catch(() => []));
    const places = await Promise.all(
      (teamIds.length ? teamIds : [undefined]).map((teamId) =>
        prLocationOf(this.projects, this.resolvedProjects, a.projectId, teamId),
      ),
    );
    const toggle = PR_OP_TOGGLE[a.op];
    if (!places.some((at) => this.autopilot.automationFor(at)[toggle])) {
      return reportFromGoal(
        ctx,
        `${a.op} ${ref}: připraveno, čeká na tebe (Autopilot tu ${a.op} sám nespouští).`,
      );
    }
    const input = {
      projectId: a.projectId,
      repo: a.repo,
      number: a.number,
      ...(pr.title ? { title: pr.title } : {}),
    };
    const { taskId } =
      a.op === "review"
        ? await this.reviews.start(input, {
            auto: true,
            ...(pr.headSha ? { headSha: pr.headSha } : {}),
            autopilotAt: places,
          })
        : a.op === "address-comments"
          ? await this.addressComments.start(input, { auto: true, autopilotAt: places })
          : await this.fixCi.start(input, { auto: true });
    await ctx.recordTask(taskId, a.actionId);
    ctx.timeline("task-started", `Started ${a.op} on ${ref}: task ${taskId} (${a.actionId}).`, {
      taskId,
    });
    ctx.activity("goal-acted", `${ctx.label}: ${a.op} ${ref}`, { taskId, action: "pr-action" });
  }
}
