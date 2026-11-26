import { Injectable, type OnModuleInit } from "@nestjs/common";
import {
  type Approval,
  type Goal,
  type GoalAction,
  type GoalDecision,
  type GoalState,
  ceilingAllows,
} from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { ApprovalsService, type ResumableRunner } from "../approvals/approvals.service";
import { AutopilotService } from "../autopilot/autopilot.service";
import { BudgetLedgerStore } from "../budget/ledger.store";
import {
  GoalActionContext,
  GoalActionExecutor,
  addWaits,
  reportFromGoal,
} from "./goal-action-executor";
import { GoalMessageService } from "./goal-message.service";
import { GoalStateStore } from "./goal-state.store";
import { GoalsStorageService } from "./goals.storage.service";

type ProposeAction = Extract<GoalAction, { type: "propose" }>;
type Candidate = ProposeAction["candidates"][number];

/** The effective `autoDecideGoals` and why: the planner is told, the handler enforces. */
export interface DecisionLevel {
  level: "manual" | "semi" | "auto";
  reason: "level" | "paused" | "ceiling";
}

const MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
});

/** `YYYY-MM` in Europe/Prague. */
export function pragueMonth(at: Date): string {
  const part = (t: string) => MONTH.formatToParts(at).find((p) => p.type === t)?.value ?? "";
  return `${part("year")}-${part("month")}`;
}

/**
 * The directional goal's actions (spec "Directional goals", "Rulings → autoDecideGoals").
 *
 * `propose` handling by the effective level at the instance's place (project > team > company >
 * global, `_` = global; Autopilot paused forces at most `semi`; a `tier1` ceiling forces
 * `manual`): `manual` writes the ranked report; `semi` raises a `goal-decision` approval
 * (approve = the top candidate, an `answer` naming a candidate id = that one); `auto` starts the
 * top candidate through the ordinary `start-task` path (budget, ceiling, `actionId` skip) while
 * the monthly cap allows and the candidate is `small`, otherwise falls back to `semi` and says
 * why. Candidates come from the stored proposal, matched by id: a channel reply or PR comment is
 * a fact, never a selection. `update-checklist` ticks an item; all done finishes the instance.
 */
@Injectable()
export class GoalDecisionService implements OnModuleInit, ResumableRunner {
  constructor(
    private readonly executor: GoalActionExecutor,
    private readonly approvals: ApprovalsService,
    private readonly store: GoalStateStore,
    private readonly goals: GoalsStorageService,
    private readonly autopilot: AutopilotService,
    private readonly messages: GoalMessageService,
    private readonly ledger: BudgetLedgerStore,
    private readonly activity: ActivityLogService,
  ) {}

  onModuleInit(): void {
    this.executor.register("propose", (a, ctx) => this.propose(a, ctx));
    this.executor.register("update-checklist", (a, ctx) => this.checklist(a, ctx));
    this.approvals.register("goal-decision", this);
  }

  /** The effective `autoDecideGoals` at the instance's place (the same place as `autoCommunicate`). */
  async decisionLevel(goal: Goal, instanceKey: string): Promise<DecisionLevel> {
    const stored = this.autopilot.levelsAt(
      await this.messages.placeOf(instanceKey),
    ).autoDecideGoals;
    if (!ceilingAllows(goal.ceiling, "start-task")) return { level: "manual", reason: "ceiling" };
    if (this.autopilot.isPaused() && stored === "auto") return { level: "semi", reason: "paused" };
    return { level: stored, reason: "level" };
  }

  // ---- propose ----

  private async propose(a: ProposeAction, ctx: GoalActionContext): Promise<void> {
    const directional = ctx.goal.directional;
    if (!directional) {
      return reportFromGoal(ctx, "Not done: propose — the goal is not directional.");
    }
    const ids = new Set(a.candidates.map((c) => c.id));
    if (ids.size !== a.candidates.length) {
      return reportFromGoal(ctx, "Not done: propose — candidate ids are not unique.");
    }
    const { level } = await this.decisionLevel(ctx.goal, ctx.instanceKey);
    const ranked = rankedText(a.candidates);
    if (level === "manual") return reportFromGoal(ctx, `Žebříček kandidátů:\n${ranked}`);

    const state = await this.store.read(ctx.goal.id, ctx.goal.createdAt);
    const cycle = state.cycle.index;
    // Unique per proposal (not per cycle): resume/cancel must resolve exactly this record.
    const id = `${ctx.instanceKey}/${cycle}/${(state.decisions ?? []).length}`;
    if (state.decisions?.some((d) => d.instance === ctx.instanceKey && d.status === "pending")) {
      return reportFromGoal(ctx, `Návrh už čeká na schválení; nový je jen zpráva:\n${ranked}`);
    }

    let why = "";
    const top = a.candidates[0] as Candidate;
    if (level === "auto") {
      const month = pragueMonth(ctx.now);
      const used = state.decisionsThisMonth.month === month ? state.decisionsThisMonth.count : 0;
      if (used >= directional.maxDecisionsPerMonth) {
        why = `Měsíční limit rozhodnutí (${directional.maxDecisionsPerMonth}) je vyčerpán.`;
      } else if (top.size !== "small") {
        why = `Nejlepší kandidát ${top.id} je velký.`;
      } else {
        return this.startTop(ctx, cycle, top, month, used);
      }
    }
    await this.requestApproval(ctx, state, id, a.candidates, why);
  }

  /** `auto`: start the top candidate through the ordinary `start-task` path and count it. */
  private async startTop(
    ctx: GoalActionContext,
    cycle: number,
    top: Candidate,
    month: string,
    used: number,
  ): Promise<void> {
    const actionId = decisionActionId(cycle, top.id);
    // Restated after it started: the executor skips it, and it is not a second decision.
    if (ctx.applied(actionId)) return;
    await this.executor.execute(
      [{ type: "start-task", actionId, text: top.task, title: top.title.slice(0, 200) }],
      ctx,
    );
    // Counted only when the work actually started (a refused budget or a failure is a report).
    if (!ctx.applied(actionId)) return;
    await this.store.update(ctx.goal.id, ctx.goal.createdAt, (s) => {
      if (s.cycle.index !== cycle) return;
      s.decisionsThisMonth = { month, count: used + 1 };
    });
    ctx.timeline("decision", `Rozhodnuto samo: ${top.title} (${top.id}).`);
    ctx.activity("goal-acted", `${ctx.label}: rozhodnuto samo — ${top.title}`, {
      action: "propose",
    });
  }

  private async requestApproval(
    ctx: GoalActionContext,
    state: GoalState,
    id: string,
    candidates: Candidate[],
    why: string,
  ): Promise<void> {
    const approval = await this.approvals.requestApproval({
      runId: `${ctx.goal.id}/${id}`,
      kind: "goal-decision",
      skill: "goal",
      action: "goal.decide",
      detail: `${why ? `${why} ` : ""}Cíl ${ctx.label} navrhuje (schválení spustí první, odpověď s id jiného spustí ten):\n${rankedText(candidates)}`,
      risk: "medium",
    });
    let stored = false;
    await this.store.update(ctx.goal.id, ctx.goal.createdAt, (s) => {
      if (s.cycle.index !== state.cycle.index) return;
      if (s.decisions?.some((d) => d.instance === ctx.instanceKey && d.status === "pending"))
        return;
      (s.decisions ??= []).push({
        id,
        instance: ctx.instanceKey,
        status: "pending",
        candidates,
        approvalId: approval.id,
        createdAt: ctx.now.toISOString(),
      });
      stored = true;
    });
    if (!stored) {
      await this.approvals.reject(approval.id, "návrh neuložen").catch(() => undefined);
      return reportFromGoal(ctx, "Not done: propose — návrh už čeká nebo začal nový cyklus.");
    }
    addWaits(ctx.instance, [{ kind: "approval", ref: approval.id }]);
    ctx.timeline("decision-proposed", `Návrh čeká na schválení.${why ? ` ${why}` : ""}`, {
      approvalId: approval.id,
    });
  }

  // ---- the approval round-trip ----

  /** Approve → start the top candidate, or the one the operator's answer names. */
  async resume(runId: string, approval?: Approval): Promise<void> {
    const found = await this.find(runId);
    if (!found) return;
    const { goal, decisionId } = found;
    const instance = decisionId.split("/")[0] ?? "_";
    let chosen: GoalDecision["candidates"][number] | undefined;
    let cycle = 0;
    let instanceState: GoalState["instances"][string] | undefined;
    let refusal: string | null = null;
    await this.store.update(goal.id, goal.createdAt, (s) => {
      cycle = s.cycle.index;
      const d = s.decisions?.find((x) => x.id === decisionId);
      if (!d || d.status !== "pending") {
        refusal = "návrh už neplatí.";
        return;
      }
      // The answer (a candidate id) is the operator's input through the approvals store only.
      const answer = approval?.reason?.trim();
      chosen = answer ? d.candidates.find((c) => c.id === answer) : d.candidates[0];
      if (!chosen) {
        d.status = "failed";
        refusal = `kandidát „${(answer ?? "").slice(0, 40)}“ v návrhu není.`;
        return;
      }
      d.status = "started";
      d.chosen = chosen.id;
      instanceState = structuredClone(s.instances[instance]);
    });
    if (refusal || !chosen || !instanceState) {
      const text = `Schválený návrh ${decisionId} nespuštěn: ${refusal ?? "instance neexistuje."}`;
      return this.say(goal, cycle, instance, text, "report");
    }
    const picked: GoalDecision["candidates"][number] = chosen;
    const actionId = decisionActionId(cycle, picked.id);
    const ctx = new GoalActionContext(
      goal,
      instance,
      instanceState,
      {},
      new Date(),
      await this.budgetLeft(goal, instanceState, cycle),
      async (taskId, id) => {
        await this.store.update(goal.id, goal.createdAt, (s) => {
          const cur = s.instances[instance];
          if (!cur || s.cycle.index !== cycle) return;
          if (!cur.taskIds.includes(taskId)) cur.taskIds.push(taskId);
          if (id && !cur.appliedActionIds?.includes(id)) (cur.appliedActionIds ??= []).push(id);
        });
      },
    );
    await this.executor.execute(
      [{ type: "start-task", actionId, text: picked.task, title: picked.title.slice(0, 200) }],
      ctx,
    );
    if (!ctx.applied(actionId)) {
      // The executor reported why (ceiling, budget, a failing service). The approval is decided
      // and cannot be approved again, so the proposal is settled: a later propose raises a new one.
      await this.store.update(goal.id, goal.createdAt, (s) => {
        const d = s.decisions?.find((x) => x.id === decisionId);
        if (d) {
          d.status = "failed";
          delete d.chosen;
        }
      });
    }
    await this.flush(goal, cycle, ctx);
    if (ctx.applied(actionId)) {
      await this.say(goal, cycle, instance, `Schváleno: spuštěn ${picked.title}.`, "decision");
    }
  }

  /** Reject → recorded, nothing starts. */
  async cancel(runId: string): Promise<void> {
    const found = await this.find(runId);
    if (!found) return;
    const { goal, decisionId } = found;
    let cycle = 0;
    let hit = false;
    await this.store.update(goal.id, goal.createdAt, (s) => {
      cycle = s.cycle.index;
      const d = s.decisions?.find((x) => x.id === decisionId);
      if (!d || d.status !== "pending") return;
      d.status = "rejected";
      hit = true;
    });
    if (hit) {
      await this.say(goal, cycle, decisionId.split("/")[0] ?? "_", "Návrh zamítnut.", "decision");
    }
  }

  /** A new cycle dropped these proposals: their pending approvals are rejected. */
  async rejectStale(approvalIds: string[]): Promise<void> {
    for (const id of approvalIds) {
      await this.approvals.reject(id, "nový cyklus cíle").catch(() => undefined);
    }
  }

  // ---- update-checklist ----

  private async checklist(
    a: Extract<GoalAction, { type: "update-checklist" }>,
    ctx: GoalActionContext,
  ): Promise<void> {
    const fresh = await this.goals.get(ctx.goal.id);
    const list = fresh.directional?.checklist;
    const item = list?.find((c) => c.id === a.id);
    if (!fresh.directional || !list || !item) {
      return reportFromGoal(ctx, `Not done: update-checklist — položka ${a.id} neexistuje.`);
    }
    if (item.done !== a.done) {
      item.done = a.done;
      await this.goals.update(fresh.id, { directional: fresh.directional });
    }
    ctx.timeline("note", `Checklist: ${item.title} → ${a.done ? "hotovo" : "otevřeno"}.`);
    if (list.every((c) => c.done)) {
      const text = "Všechny položky checklistu jsou hotové.";
      ctx.instance.status = "done";
      ctx.instance.summary = text;
      delete ctx.instance.waitingOn;
      delete ctx.instance.wakeAt;
      ctx.timeline("done", text);
      ctx.activity("goal-done", `${ctx.label}: ${text}`);
    }
  }

  // ---- helpers ----

  private async budgetLeft(goal: Goal, instance: { taskIds: string[] }, cycle: number) {
    const { maxRunsPerCycle, maxCostUsdPerCycle } = goal.budget ?? {};
    const out: { runs?: number; costUsd?: number } = {};
    if (maxRunsPerCycle !== undefined) out.runs = maxRunsPerCycle - instance.taskIds.length;
    if (maxCostUsdPerCycle !== undefined) {
      const state = await this.store.read(goal.id, goal.createdAt);
      const spent = await this.ledger.sumCostForTasks(
        instance.taskIds,
        new Date(state.cycle.index === cycle ? state.cycle.startedAt : Date.now()),
        new Date(),
      );
      out.costUsd = maxCostUsdPerCycle - spent;
    }
    return out;
  }

  private async find(runId: string): Promise<{ goal: Goal; decisionId: string } | null> {
    const slash = runId.indexOf("/");
    const goal = slash < 0 ? null : await this.goals.get(runId.slice(0, slash)).catch(() => null);
    return goal ? { goal, decisionId: runId.slice(slash + 1) } : null;
  }

  /** The handlers' effects (timeline lines, activity) written outside a tick. */
  private async flush(goal: Goal, cycle: number, ctx: GoalActionContext): Promise<void> {
    for (const e of ctx.effects) {
      if (e.type === "timeline") {
        await this.store.appendTimeline(goal.id, {
          at: new Date().toISOString(),
          cycle,
          instance: e.instance,
          kind: e.kind,
          text: e.text,
          ...(e.refs ? { refs: e.refs } : {}),
        });
      } else {
        await this.activity.record({ kind: e.kind, summary: e.summary, refs: e.refs });
      }
    }
  }

  private async say(goal: Goal, cycle: number, instance: string, text: string, kind: string) {
    await this.store.appendTimeline(goal.id, {
      at: new Date().toISOString(),
      cycle,
      instance,
      kind,
      text,
    });
    await this.activity.record({
      kind: "goal-acted",
      summary: `${goal.name}: ${text}`.slice(0, 300),
      refs: {
        goalId: goal.id,
        itemId: instance,
        ...(instance !== "_" ? { projectId: instance } : {}),
        action: "propose",
      },
    });
  }
}

/** The `start-task` action id of a candidate: stable per cycle, so a restated start is skipped. */
function decisionActionId(cycle: number, candidateId: string): string {
  return `dec-${cycle}-${candidateId}`;
}

function rankedText(candidates: Candidate[]): string {
  return candidates
    .map((c, i) => `${i + 1}. [${c.id}] ${c.title} (${c.size})${c.why ? ` — ${c.why}` : ""}`)
    .join("\n");
}
