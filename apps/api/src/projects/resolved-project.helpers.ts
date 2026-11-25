import {
  type Integration,
  type KnowledgeBaseSource,
  PROJECT_SCOPED_KINDS,
  type Project,
  type ProjectBudget,
  type ProjectPerson,
  type Team,
  isPersonalAccount,
} from "@zibby/contracts";

/**
 * Pure merge rules behind the resolved-project context (Phase 70 — the read-time
 * merge of a project with its company). Kept free of NestJS/DB concerns so each
 * rule is unit-testable in isolation; {@link ResolvedProjectService} is the only
 * caller that wires these to the storage layer.
 *
 * None of these functions ever throw or need a "company missing" branch: the
 * dangling-`companyId` / no-company cases are handled by the caller passing an
 * empty roster / `undefined` budget / empty integrations array for "no company" —
 * every merge below degrades to the project's own raw data when the company side
 * is empty, which is exactly the Phase 68 binding decision (see the master plan's
 * "dangling companyId" cross-cutting decision).
 */

/**
 * Do two {@link ProjectPerson} records refer to the same person (Phase 68 decision 3)?
 * Match by `id` when BOTH sides have one; otherwise fall back to a case-insensitive
 * `name` match (covers a roster mid-backfill, per the Phase 69 migration decision).
 */
export function samePerson(a: ProjectPerson, b: ProjectPerson): boolean {
  if (a.id !== undefined && b.id !== undefined) return a.id === b.id;
  return a.name.toLowerCase() === b.name.toLowerCase();
}

/**
 * Merge a company's canonical roster with a project's own people:
 * - a project person matching a company person (by {@link samePerson}) OVERRIDES it
 *   — a field-level merge, the project's fields win, fields it left unset keep the
 *   company's;
 * - a project person with no match is ADDED;
 * - a company person with no matching project override passes through unchanged.
 *
 * Order: company roster first (in company order), then any project-only additions
 * appended in project order. `companyPeople`/`projectPeople` are never mutated.
 */
export function mergePeople(
  companyPeople: ProjectPerson[],
  projectPeople: ProjectPerson[],
): ProjectPerson[] {
  const result = companyPeople.map((person) => ({ ...person }));
  for (const projectPerson of projectPeople) {
    const idx = result.findIndex((companyPerson) => samePerson(companyPerson, projectPerson));
    if (idx === -1) {
      result.push({ ...projectPerson });
    } else {
      // Field-level override: project's own fields win, unset fields inherit the
      // company person's. TypeScript can't see `result[idx]` is defined from
      // `findIndex >= 0`, hence the non-null assertion.
      result[idx] = { ...result[idx]!, ...projectPerson };
    }
  }
  return result;
}

/**
 * Field-level budget merge (Phase 68 decision 3): every field the project set wins;
 * every field it left unset inherits the company's default. Not all-or-nothing —
 * a project with only `dailyRuns` set still inherits the company's cost caps.
 * `undefined` + `undefined` → `undefined` (no budget at all, same as today for a
 * company-less project with no budget of its own).
 */
export function mergeBudget(
  companyBudget: ProjectBudget | undefined,
  projectBudget: ProjectBudget | undefined,
): ProjectBudget | undefined {
  if (!companyBudget && !projectBudget) return undefined;
  return { ...companyBudget, ...projectBudget };
}

/**
 * The slot an account fills for a project: its kind — except GitLab, where each host is
 * its own slot (`gitlab:<host>`), so a company's self-hosted GitLab and the operator's
 * gitlab.com account can both serve one project.
 */
export function accountSlot(account: Integration): string {
  return account.config.kind === "gitlab"
    ? `gitlab:${account.config.host.toLowerCase()}`
    : account.kind;
}

/**
 * The accounts that serve a project (accounts-model decision 4): its effective company's
 * accounts first, then the operator's personal accounts of a `PROJECT_SCOPED_KINDS` kind
 * (a personal mailbox / calendar / Slack is never inherited). First wins per
 * {@link accountSlot}; each group is ordered by id, so the winner is deterministic.
 */
export function resolveAccounts(all: Integration[], companyId: string | undefined): Integration[] {
  const byId = (a: Integration, b: Integration) => a.id.localeCompare(b.id);
  const company = companyId ? all.filter((i) => i.companyId === companyId).sort(byId) : [];
  const personal = all
    .filter((i) => isPersonalAccount(i) && PROJECT_SCOPED_KINDS.includes(i.kind))
    .sort(byId);
  const taken = new Set<string>();
  return [...company, ...personal].filter((account) => {
    const slot = accountSlot(account);
    if (taken.has(slot)) return false;
    taken.add(slot);
    return true;
  });
}

/** The three effective (merged) facets a project resolves at read time. */
export interface ResolvedProjectContext {
  people: ProjectPerson[];
  budget: ProjectBudget | undefined;
  integrations: Integration[];
}

/**
 * Compute the full resolved context from already-fetched raw inputs — the pure
 * counterpart to {@link ResolvedProjectService.resolve}. `company` is `null` for
 * "no company" (no `companyId`, or a dangling one that failed to resolve): people and
 * budget then degrade to the project's own raw data, and only the operator's
 * project-scoped personal accounts serve it.
 */
export function computeResolvedContext(
  project: Project,
  company: { id: string; people?: ProjectPerson[]; budget?: ProjectBudget } | null,
  accounts: Integration[],
): ResolvedProjectContext {
  return {
    people: mergePeople(company?.people ?? [], project.identity?.people ?? []),
    budget: mergeBudget(company?.budget, project.budget),
    integrations: resolveAccounts(accounts, company?.id),
  };
}

/**
 * Effective company for a project (project → team → company): an explicit
 * project link stays authoritative; otherwise it is inherited from the
 * project's team. `team` is `null` for "no team" — no `teamId`, or a dangling
 * one the caller already resolved to `null` (same tolerance as a dangling
 * `companyId` elsewhere in this file).
 */
export function resolveEffectiveCompanyId(
  project: Pick<Project, "id" | "name" | "companyId">,
  team: Pick<Team, "id" | "name" | "companyId" | "knowledgeBase"> | null,
): string | undefined {
  return project.companyId ?? team?.companyId;
}

/**
 * Effective knowledge base for a project. v1: the owning team's, or none.
 * The signature takes the resolved team (not a `teamId`) so a future
 * project-level or company-level knowledge base can be layered in without
 * changing call sites.
 *
 * `project` is intentionally unused today — it is the documented seam for
 * that future project-level source, kept rather than deleted.
 */
export function resolveKnowledgeBase(
  _project: Pick<Project, "id" | "name">,
  team: Pick<Team, "id" | "name" | "companyId" | "knowledgeBase"> | null,
): KnowledgeBaseSource | null {
  return team?.knowledgeBase ?? null;
}
