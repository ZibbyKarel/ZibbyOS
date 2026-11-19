import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";
import {
  AUTOMATION_KEYS,
  AUTOMATION_LEVEL_RANK,
  AUTOPILOT_SCOPE_TOGGLE,
  type Agent,
  type Approval,
  type AutomationToggles,
  type AutopilotActor,
  type AutopilotAutomation,
  type AutopilotLocation,
  type AutopilotScope,
  type AutopilotScopeKey,
  type AutopilotState,
  AutopilotStateSchema,
  type AutopilotStatus,
  type DepartmentId,
  type IntendedAction,
  type Workflow,
  resolveAutopilotAutomation,
  resolveAutopilotLevels,
} from "@zibby/contracts";
import { ActivityLogService } from "../activity/activity-log.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { ensureDir, safeJson, writeFileAtomic } from "../shared/file-storage";

/** DI token for the directory holding `autopilot.json`. */
export const AUTOPILOT_DIR = "AUTOPILOT_DIR";

const FILE = "autopilot.json";

/** ZIBBY's own run branches (`WorkspaceService`: `zibby/<runId>-<slug>`). */
export function isZibbyBranch(branch: string | undefined): boolean {
  return !!branch && branch.startsWith("zibby/") && branch.length > "zibby/".length;
}

/**
 * What a caller established about the intent, beyond the intent itself. Never part of
 * `IntendedAction`, so a hook-posted intent can't claim it.
 * - `ownedBranch` — the head of a PR the operator authored (ZIBBY opens its PRs with the
 *   operator's token, so this is "ZIBBY's or the operator's" branch); a push onto it is
 *   covered like a `zibby/*` one.
 * - `scope` — the class the caller acts for; a hook intent (none given) counts as `comments`.
 * - `at` — where in the tree the class is read (any of several = covered); none = global.
 */
export interface AutopilotContext {
  ownedBranch?: string;
  scope?: AutopilotScopeKey;
  at?: AutopilotAt;
}

/** One place, or several (a PR of several teams: covered when any of them has the toggle on). */
export type AutopilotAt = AutopilotLocation | readonly AutopilotLocation[];

/** A push target autopilot covers: a `zibby/*` branch, or the given operator-owned PR head. */
function isOwnBranch(branch: string | undefined, ownedBranch?: string): boolean {
  return isZibbyBranch(branch) || (!!branch && branch === ownedBranch);
}

/**
 * Gate side of the allowlist: the system rule ids whose `ask` autopilot may turn into
 * act-then-report, each with the intent it covers (checked too, so a rule whose match
 * was edited never widens the overlay). Everything else — merge, deploy, payments,
 * spend past cap, deletes, force push, the generic `gh.api_write`, a push to a branch
 * that is neither ZIBBY's nor the operator's, operator questions — is not here and is untouched.
 */
export const AUTOPILOT_COVERED_RULES: Readonly<
  Record<string, (action: IntendedAction, context: AutopilotContext) => boolean>
> = {
  "floor-gh.pr_comment": (a) => a.action === "gh.pr_comment",
  // A comment also matches its parent class's system rule (`gh.pr_comment` ⊂ `gh.api_write`);
  // only that rule's `ask` is lifted, and only for a comment — a deny there still wins.
  "floor-gh.api_write": (a) => a.action === "gh.pr_comment",
  "floor-git.push": (a, c) => a.action === "git.push" && isOwnBranch(a.branch, c.ownedBranch),
};

/** The scope toggle an approval kind falls under; `null` = covered whenever autopilot is on. */
export function autopilotScopeFor(kind: Approval["kind"]): AutopilotScopeKey | null {
  switch (kind) {
    case "pr-review":
    case "workflow-gate":
      return "reviews";
    case "pr-address-comments":
      return "comments";
    case "channel":
      return "communication";
    case "pr-fix-ci":
    case "pr-ci-rerun":
      return "ci";
    default:
      return null;
  }
}

/**
 * Approval side of the allowlist: the approvals ZIBBY's own outbound flows raise for
 * the covered classes. Approved by autopilot at creation (never one already pending).
 * `headBranch` is the PR head a push approval would push to; `ownPr` = the operator
 * authored that PR. Scope toggles are the service's ({@link AutopilotService.coversApproval}).
 *
 * - `pr-review` "github.pr.review" — post a finished code review (as COMMENT);
 * - `workflow-gate` carrying `suggestedReviewEvent` — the pr-review workflow's sign-off gate;
 * - `pr-address-comments` "github.pr.comment" — post review-thread replies;
 * - `pr-address-comments` / `pr-fix-ci` "git.push" — only onto a `zibby/*` head or the operator's own PR;
 * - `channel` "channel-reply" — send a researched (concrete) reply draft.
 */
export function autopilotCoversApproval(
  approval: Pick<Approval, "kind" | "action" | "suggestedReviewEvent">,
  headBranch?: string,
  ownPr?: boolean,
): boolean {
  const ownPush =
    approval.action === "git.push" &&
    (isZibbyBranch(headBranch) || (ownPr === true && !!headBranch));
  switch (approval.kind) {
    case "pr-review":
      return approval.action === "github.pr.review";
    case "workflow-gate":
      return approval.suggestedReviewEvent !== undefined;
    case "pr-address-comments":
      return approval.action === "github.pr.comment" || ownPush;
    case "pr-fix-ci":
      return ownPush;
    case "channel":
      return approval.action === "channel-reply";
    default:
      return false;
  }
}

/**
 * The gate intent a covered approval stands for, so the approval side can ask the gate
 * evaluator the same question the hook side does (operator, agent and department rules
 * included). `null` → no intent can be built, and autopilot leaves the approval alone.
 */
export function autopilotIntentFor(
  approval: Pick<Approval, "kind" | "action">,
  headBranch?: string,
  ownPr?: boolean,
): IntendedAction | null {
  if (approval.action === "git.push") {
    return headBranch && (isZibbyBranch(headBranch) || ownPr === true)
      ? { action: "git.push", branch: headBranch }
      : null;
  }
  if (approval.kind === "pr-review" || approval.kind === "workflow-gate") {
    return { action: "gh.pr_comment" };
  }
  if (approval.kind === "pr-address-comments" && approval.action === "github.pr.comment") {
    return { action: "gh.pr_comment" };
  }
  return null;
}

/** The {@link AutopilotContext} the gate check of a covered approval runs with. */
export function autopilotContextFor(
  approval: Pick<Approval, "kind">,
  headBranch?: string,
  ownPr?: boolean,
  at?: AutopilotAt,
): AutopilotContext {
  const scope = autopilotScopeFor(approval.kind);
  return {
    ...(scope ? { scope } : {}),
    ...(ownPr === true && headBranch ? { ownedBranch: headBranch } : {}),
    ...(at ? { at } : {}),
  };
}

export type { AutopilotLocation };

/** The gate rules of a run's acting unit: its agents' own rules and its department. */
export interface AutopilotActors {
  agents: Pick<Agent, "gates" | "requires_approval">[];
  department?: DepartmentId;
}

/**
 * Resolve the agents and department a task target acts as: an agent (its own rules and
 * department) or a workflow (every phase agent, the workflow's department). Any other
 * target, or a missing agent/workflow, throws — the caller then fails closed.
 */
export async function autopilotActors(
  target: { kind: string; id?: string } | undefined,
  stores: {
    agents: { get(id: string): Promise<Agent> };
    workflows?: { get(id: string): Promise<Workflow> };
  },
): Promise<AutopilotActors> {
  if (target?.kind === "agent" && target.id) {
    const agent = await stores.agents.get(target.id);
    return { agents: [agent], department: agent.department };
  }
  if (target?.kind === "workflow" && target.id && stores.workflows) {
    const workflow = await stores.workflows.get(target.id);
    const ids = workflow.phases.flatMap((p) => (p.agent ? [p.agent] : []));
    return {
      agents: await Promise.all(ids.map((id) => stores.agents.get(id))),
      department: workflow.department,
    };
  }
  throw new Error(`autopilot: no gate actors for a ${target?.kind ?? "missing"} target`);
}

/** Every node of a tree (global, each company, each team). */
function nodesOf(automation: AutopilotAutomation | undefined): AutopilotLocation[] {
  const { companies = {}, teams = {} } = automation ?? {};
  return [
    {},
    ...Object.keys(companies).map((companyId) => ({ companyId })),
    ...Object.keys(teams).map((teamId) => ({ teamId })),
  ];
}

/**
 * Whether `next` raises any cell over `prev` anywhere in the tree (manual < semi < auto). Raising
 * needs the operator token; lowering and re-arranging at the same or a lower level never does.
 * A team is checked under every company the two trees know, so a team override is never missed.
 */
export function automationRaises(
  prev: AutopilotAutomation | undefined,
  next: AutopilotAutomation,
): boolean {
  const companies = new Set([
    ...Object.keys(prev?.companies ?? {}),
    ...Object.keys(next.companies),
  ]);
  const places: AutopilotLocation[] = [...nodesOf(prev), ...nodesOf(next)];
  for (const teamId of new Set([...Object.keys(prev?.teams ?? {}), ...Object.keys(next.teams)]))
    for (const companyId of companies) places.push({ companyId, teamId });
  return places.some((at) => {
    const before = resolveAutopilotLevels({ automation: prev }, at);
    const after = resolveAutopilotLevels({ automation: next }, at);
    return AUTOMATION_KEYS.some(
      (k) => AUTOMATION_LEVEL_RANK[after[k]] > AUTOMATION_LEVEL_RANK[before[k]],
    );
  });
}

/**
 * Phase 4 — the autopilot switch. `autopilot.json` is the truth; it is read once at
 * boot and cached, because the gate evaluator asks synchronously on every intent.
 * ponytail: a hand edit of the file applies on the next restart; the API is the way to switch.
 *
 * The overlay itself lives with its callers (the gate evaluator for intents, the
 * approval park sites for approvals); this service only answers "is it on, and is
 * this covered" and records the switch.
 */
@Injectable()
export class AutopilotService implements OnModuleInit {
  private state: AutopilotState = { paused: false };

  constructor(
    @Inject(AUTOPILOT_DIR) private readonly dir: string,
    @Optional() private readonly approvals?: ApprovalsService,
    @Optional() private readonly activity?: ActivityLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    const raw = await fs.readFile(path.join(this.dir, FILE), "utf8").catch(() => null);
    const parsed = AutopilotStateSchema.safeParse(raw === null ? null : safeJson(raw));
    // A legacy (pre-redesign) file is migrated on read and rewritten on the next switch.
    this.state = parsed.success ? parsed.data : { paused: false };
  }

  /** Whether any cell anywhere is `auto` and nothing is paused: the overlay can act at all. */
  isOn(): boolean {
    const a = this.state.automation;
    if (this.state.paused || !a) return false;
    return [a.global, ...Object.values(a.companies), ...Object.values(a.teams)].some((node) =>
      Object.values(node).includes("auto"),
    );
  }

  /** {@link scope} at any node of the tree — for an action that has no location of its own. */
  scopeAnywhere(): AutopilotScope {
    return this.scope(nodesOf(this.state.automation));
  }

  isPaused(): boolean {
    return this.state.paused;
  }

  /**
   * The classes the overlay covers at a company/team (global when `at` is empty): the class's
   * capability is `auto` there (any of several places), and nothing is paused.
   */
  scope(at: AutopilotAt = {}): AutopilotScope {
    const places: readonly AutopilotLocation[] = Array.isArray(at) ? at : [at as AutopilotLocation];
    const all = (places.length ? places : [{}]).map((p) => resolveAutopilotLevels(this.state, p));
    const out: AutopilotScope = {
      reviews: false,
      comments: false,
      communication: false,
      ci: false,
    };
    if (this.state.paused) return out;
    for (const k of Object.keys(out) as AutopilotScopeKey[])
      out[k] = all.some((levels) => levels[AUTOPILOT_SCOPE_TOGGLE[k]] === "auto");
    return out;
  }

  /** Which capabilities start work at a company/team (`semi` or `auto`); all false while paused. */
  automationFor(at: AutopilotLocation): AutomationToggles {
    return resolveAutopilotAutomation(this.state, at);
  }

  /** Whether the overlay turns this system rule's `ask` into act-then-report right now. */
  coversRule(ruleId: string, action: IntendedAction, context: AutopilotContext = {}): boolean {
    if (!this.isOn()) return false;
    // A PR comment belongs to whichever class posts it; a push is never toggled off.
    if (action.action === "gh.pr_comment" && !this.scope(context.at)[context.scope ?? "comments"]) {
      return false;
    }
    return AUTOPILOT_COVERED_RULES[ruleId]?.(action, context) ?? false;
  }

  /** Whether autopilot approves this freshly requested approval right now (`at` = where it acts). */
  coversApproval(
    approval: Pick<Approval, "kind" | "action" | "suggestedReviewEvent">,
    headBranch?: string,
    ownPr?: boolean,
    at: AutopilotAt = {},
  ): boolean {
    if (!this.isOn()) return false;
    const key = autopilotScopeFor(approval.kind);
    if (key && !this.scope(at)[key]) return false;
    return autopilotCoversApproval(approval, headBranch, ownPr);
  }

  async status(): Promise<AutopilotStatus> {
    const pending = (await this.approvals?.list("pending").catch(() => [])) ?? [];
    return { ...this.state, pendingApprovals: pending.length };
  }

  /**
   * Switch the level. Authorization is the caller's: only the operator-token route may
   * pass `full`. A no-op (no file write) only when level and automation tree are unchanged.
   * On/off is never pushed to Slack.
   */
  /** The stored tree, for the controller's raise check. */
  automation(): AutopilotAutomation | undefined {
    return this.state.automation;
  }

  async set(
    change: { paused?: boolean; automation?: AutopilotAutomation },
    by: AutopilotActor,
  ): Promise<AutopilotStatus> {
    // Omitted keeps the stored value.
    const paused = change.paused ?? this.state.paused;
    const nextAutomation = change.automation ?? this.state.automation;
    if (
      paused === this.state.paused &&
      JSON.stringify(nextAutomation) === JSON.stringify(this.state.automation)
    ) {
      return this.status();
    }
    const next: AutopilotState = {
      paused,
      since: new Date().toISOString(),
      by,
      ...(nextAutomation ? { automation: nextAutomation } : {}),
    };
    await ensureDir(this.dir);
    await writeFileAtomic(path.join(this.dir, FILE), `${JSON.stringify(next, null, 2)}\n`);
    this.state = next;
    const status = await this.status();
    const auto = (Object.keys(AUTOPILOT_SCOPE_TOGGLE) as AutopilotScopeKey[]).filter(
      (k) => this.scopeAnywhere()[k],
    );
    void this.activity?.record({
      kind: "autopilot-changed",
      summary: paused
        ? `ZIBBY paused (${by}) — nothing new starts or is sent`
        : `autonomy levels changed (${by}; auto: ${auto.length ? auto.join(", ") : "none"}) — ${status.pendingApprovals} approvals still pending, not auto-decided`,
      refs: { status: paused ? "paused" : "running", decision: by },
    });
    return status;
  }
}
