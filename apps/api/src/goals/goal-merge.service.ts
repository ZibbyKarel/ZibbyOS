import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { type GoalAction, MERGE_GRANT_MAX_HOURS } from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { ProjectPrService } from "../projects/project-pr.service";
import { type GoalActionContext, GoalActionExecutor, reportFromGoal } from "./goal-action-executor";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

type MergeAction = Extract<GoalAction, { type: "merge" }>;

/**
 * The goal engine's `merge` action: the one sanctioned autonomous merge (Law 3 exception, spec
 * "Merge grant"). The executor already applied the tier3 ceiling and the `actionId` skip; this
 * handler re-checks everything else at merge time and **fails closed** — any precondition not
 * met, or any error while reading one, is a "ready to merge" report naming it, never a merge:
 *
 * 1. the instance is a project instance and the action names that project;
 * 2. the goal, re-read from storage, still has ceiling tier3 and an unexpired grant listing it;
 * 3. Autopilot is not paused;
 * 4. live from the git host ({@link ProjectPrService.mergeState}): same repo, open, not draft,
 *    not merged yet, no current change request, head SHA === `approvedSha` and an approving
 *    review given on that SHA, CI green and settled, `mergeable === true`, `mergeable_state`
 *    `clean`;
 * 5. 2–3 again right before the merge (the host read is slow).
 *
 * The merge itself goes through {@link ProjectPrService.merge} with the head pinned, so a push
 * after the check makes GitHub refuse it. The planner's payload is only a claim to compare.
 */
@Injectable()
export class GoalMergeService implements OnModuleInit {
  private readonly log = new Logger(GoalMergeService.name);

  constructor(
    private readonly executor: GoalActionExecutor,
    private readonly goals: GoalsStorageService,
    private readonly store: GoalStateStore,
    private readonly autopilot: AutopilotService,
    private readonly prs: ProjectPrService,
    private readonly activity: ActivityLogService,
  ) {}

  onModuleInit(): void {
    this.executor.register("merge", (a, ctx) => this.handle(a, ctx));
  }

  async handle(a: MergeAction, ctx: GoalActionContext): Promise<void> {
    const ref = `${a.repo}#${a.number}`;
    const ready = (why: string) =>
      reportFromGoal(ctx, `Připraveno k merge (ready to merge): ${ref} — ${why}.`);
    let headSha: string;
    try {
      const why = await this.unmet(a, ctx);
      if (typeof why === "string") return ready(why);
      if (why.merged) return reportFromGoal(ctx, `${ref} už je mergnuté (already merged).`);
      headSha = why.headSha;
      // Again right before the merge: a revoke or a pause during the slow host read wins.
      const late = await this.grantUnmet(a, ctx);
      if (late) return ready(late);
    } catch (error) {
      return ready(`podmínku nešlo ověřit (${errorText(error)})`);
    }
    let merged: boolean;
    try {
      ({ merged } = await this.prs.merge(a.projectId, a.number, undefined, false, headSha));
    } catch (error) {
      return ready(`merge odmítnut (${errorText(error)})`);
    }
    if (!merged) return ready("git host merge neprovedl");

    // Written now, not as a ctx effect: a dropped `apply` must not hide a merge that happened.
    (ctx.instance.appliedActionIds ??= []).push(a.actionId);
    await this.store
      .update(ctx.goal.id, ctx.goal.createdAt, (s) => {
        const inst = s.instances[ctx.instanceKey];
        if (inst && !inst.appliedActionIds?.includes(a.actionId)) {
          (inst.appliedActionIds ??= []).push(a.actionId);
        }
      })
      .catch((e: unknown) =>
        this.log.error(`merged ${ref} but recording ${a.actionId} failed: ${errorText(e)}`),
      );
    const text = `Mergnuto na základě merge grantu: ${ref} (${headSha.slice(0, 7)}).`;
    ctx.timeline("merged", text, { actionId: a.actionId });
    await this.activity
      .record({
        kind: "goal-merged",
        summary: `${ctx.label}: ${text}`,
        refs: {
          goalId: ctx.goal.id,
          itemId: ctx.instanceKey,
          projectId: a.projectId,
          action: "merge",
        },
      })
      .catch((e: unknown) =>
        this.log.error(`merged ${ref} but the goal-merged activity failed: ${errorText(e)}`),
      );
  }

  /** The first unmet precondition (text), or the live PR state when all hold. */
  private async unmet(
    a: MergeAction,
    ctx: GoalActionContext,
  ): Promise<string | { merged: boolean; headSha: string }> {
    if (!ctx.projectId || a.projectId !== ctx.projectId) return "mimo projekt této instance";
    const grantWhy = await this.grantUnmet(a, ctx);
    if (grantWhy) return grantWhy;

    const pr = await this.prs.mergeState(a.projectId, a.number);
    if (!pr) return "git host neumí ověřit commit schválení (jen GitHub)";
    if (pr.repo.toLowerCase() !== a.repo.toLowerCase()) return "repo nepatří k projektu";
    if (pr.merged) return { merged: true, headSha: pr.headSha };
    if (pr.state !== "open") return "PR je zavřené";
    if (pr.draft) return "PR je draft";
    if (pr.changesRequested) return "reviewer žádá změny";
    if (pr.headSha !== a.approvedSha) return "po schválení přibyl commit (head ≠ approvedSha)";
    if (!pr.approvedShas.includes(pr.headSha)) return "chybí schválení na aktuálním head SHA";
    if (pr.ci !== "green") return `CI není zelené a dokončené (${pr.ci})`;
    if (pr.mergeable !== true) return "PR není mergeable (nebo to host ještě nespočítal)";
    // `clean` = every branch-protection requirement met (required checks/reviews, codeowners),
    // so an admin token cannot merge past protection.
    if (pr.mergeableState !== "clean") {
      return `branch protection není splněná (mergeable_state ${pr.mergeableState ?? "chybí"})`;
    }
    return { merged: false, headSha: pr.headSha };
  }

  /** Goal (fresh from storage), grant and pause preconditions, or null when they hold. */
  private async grantUnmet(a: MergeAction, ctx: GoalActionContext): Promise<string | null> {
    // Fresh from storage: the tick's cached goal may predate a revoke or a lowered ceiling.
    const goal = await this.goals.get(ctx.goal.id);
    if (goal.ceiling !== "tier3") return "strop cíle už není tier3";
    const grant = goal.mergeGrant;
    if (!grant) return "cíl nemá merge grant";
    const now = Date.now();
    const until = Date.parse(grant.until);
    const granted = Date.parse(grant.grantedAt);
    const max = MERGE_GRANT_MAX_HOURS * 3_600_000;
    if (!(until > now)) return "merge grant vypršel";
    // The file is hand-editable: the 24 h cap is re-checked here, not only on write — from both
    // ends, so a future `grantedAt` cannot stretch it. Unparseable dates fail closed (NaN).
    if (!(granted <= now && until - granted <= max && until - now <= max)) {
      return `merge grant je delší než ${MERGE_GRANT_MAX_HOURS} h`;
    }
    if (!grant.projectIds.includes(a.projectId)) return "merge grant nepokrývá tento projekt";
    if (this.autopilot.isPaused()) return "Autopilot je pozastavený";
    return null;
  }
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
