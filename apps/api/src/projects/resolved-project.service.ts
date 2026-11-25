import { Injectable } from "@nestjs/common";
import {
  type Company,
  type Integration,
  type KnowledgeBaseSource,
  type Project,
  type ProjectBudget,
  type ProjectPerson,
  type Team,
  githubRepoFor,
  gitlabRepoFor,
} from "@zibby/contracts";
import { CompaniesStorageService } from "../companies/companies.storage.service";
import { IntegrationsStorageService } from "../integrations/integrations.storage.service";
import { TeamsStorageService } from "../teams/teams.storage.service";
import {
  type ResolvedProjectContext,
  computeResolvedContext,
  mergeBudget,
  mergePeople,
  resolveAccounts,
  resolveEffectiveCompanyId,
  resolveKnowledgeBase,
} from "./resolved-project.helpers";
import { type GitlabLink, resolveGitlabLink } from "../git-host/gitlab-link";
import { ProjectsStorageService } from "./projects.storage.service";

/**
 * Computes a project's EFFECTIVE people / budget / integrations by merging its
 * linked company's data at READ TIME (Phase 70 — the master plan's "resolved
 * project context service"). Never persists anything: editing the company (or the
 * project) is reflected live on the next resolve, same idiom as the computed
 * `hasSecrets` on `Project`.
 *
 * A `project.companyId` that doesn't resolve to an existing company (deleted
 * company, dangling reference — Phase 68/69's "allow delete, no cascade" decision)
 * is treated as "no company": every method below returns the project's own raw
 * data rather than throwing/500ing. A project with no `companyId` at all takes the
 * exact same path (identity — company is `null` either way).
 *
 * The actual field-merge rules are pure functions in `resolved-project.helpers.ts`,
 * unit-tested there without touching storage; this service is only the DB-facing
 * seam (company lookup + which accounts serve which project).
 *
 * Phase 3 (team knowledge base): the effective company is now resolved through
 * the project's team when the project has no `companyId` of its own — see
 * {@link resolveEffectiveCompanyId} — so every merge above inherits a
 * team-linked company unchanged; the project's own `companyId` stays
 * authoritative when set. `teams`/`projects` are typed optional purely so the
 * pre-existing two-arg `new ResolvedProjectService(companies, integrations)`
 * test construction keeps compiling (NOT `@Optional()` — both are still
 * required providers at Nest boot, wired via `TeamsModule`/`ProjectsModule`).
 */
@Injectable()
export class ResolvedProjectService {
  constructor(
    private readonly companies: CompaniesStorageService,
    private readonly integrations: IntegrationsStorageService,
    private readonly teams?: TeamsStorageService,
    private readonly projects?: ProjectsStorageService,
  ) {}

  /** Effective (company-merged) people for `project`. */
  async resolvePeople(project: Project): Promise<ProjectPerson[]> {
    const company = await this.findCompany(await this.effectiveCompanyId(project));
    return mergePeople(company?.people ?? [], project.identity?.people ?? []);
  }

  /** Effective (field-level, company-merged) budget for `project`. */
  async resolveBudget(project: Project): Promise<ProjectBudget | undefined> {
    const company = await this.findCompany(await this.effectiveCompanyId(project));
    return mergeBudget(company?.budget, project.budget);
  }

  /**
   * THE seam for "which accounts serve this project": the effective company's accounts,
   * then the operator's project-scoped personal accounts, first wins per slot
   * (see {@link resolveAccounts}).
   */
  async resolveIntegrations(project: Project): Promise<Integration[]> {
    const company = await this.findCompany(await this.effectiveCompanyId(project));
    return resolveAccounts(await this.integrations.list(), company?.id);
  }

  /**
   * All three facets in one call, sharing a single company lookup + a single
   * integrations listing — the cheapest way for a consumer that needs more than
   * one facet (e.g. a future project-detail read) to get the full context.
   */
  async resolve(project: Project): Promise<ResolvedProjectContext> {
    const company = await this.findCompany(await this.effectiveCompanyId(project));
    return computeResolvedContext(project, company, await this.integrations.list());
  }

  /** The project's effective company record (project → team → company), or `undefined`. */
  async resolveCompany(project: Project): Promise<Company | undefined> {
    return (await this.findCompany(await this.effectiveCompanyId(project))) ?? undefined;
  }

  /**
   * The projects an account serves: those whose resolved set ({@link resolveIntegrations})
   * contains it — for a company account and a personal one alike. So a repo is polled by
   * exactly one account.
   */
  async inheritingProjects(integration: Integration): Promise<Project[]> {
    if (!this.projects) return [];
    const all = await this.integrations.list();
    const out: Project[] = [];
    for (const project of await this.projects.list()) {
      const company = await this.findCompany(await this.effectiveCompanyId(project));
      if (resolveAccounts(all, company?.id).some((i) => i.id === integration.id)) out.push(project);
    }
    return out;
  }

  /**
   * The distinct repos a GitHub account covers, each with the served projects on it (repo → project ids, in project order).
   * A project whose repo can't be resolved (no/odd `gitRemote`) is left out.
   */
  async githubRepoTargets(integration: Integration): Promise<Map<string, string[]>> {
    const targets = new Map<string, string[]>();
    for (const project of await this.inheritingProjects(integration)) {
      const repo = githubRepoFor(integration, project);
      if (!repo) continue;
      targets.set(repo, [...(targets.get(repo) ?? []), project.id]);
    }
    return targets;
  }

  /** {@link githubRepoTargets} for a GitLab integration: repo path → inheriting project ids. */
  async gitlabRepoTargets(integration: Integration): Promise<Map<string, string[]>> {
    const targets = new Map<string, string[]>();
    for (const project of await this.inheritingProjects(integration)) {
      const repo = gitlabRepoFor(integration, project);
      if (!repo) continue;
      targets.set(repo, [...(targets.get(repo) ?? []), project.id]);
    }
    return targets;
  }

  /**
   * The linked company's `id`/`name` — `undefined` for "no company" (absent
   * `companyId`, or a dangling one whose company was deleted). Only for the wire
   * context's UI-facing "resolved from company X" note (Phase 72); the merge
   * itself (above) never needs the name, so this is a separate, additive lookup
   * that doesn't change {@link resolve}'s existing (tested) return shape.
   */
  async resolveCompanyRef(project: Project): Promise<{ id: string; name: string } | undefined> {
    const company = await this.findCompany(await this.effectiveCompanyId(project));
    return company ? { id: company.id, name: company.name } : undefined;
  }

  /**
   * The Jira project key for `project` (accounts-model decision 6): its team's `board`,
   * else the serving Jira `account`'s `config.projectKey`. `undefined` when neither is set.
   */
  async jiraProjectKey(project: Project, account?: Integration): Promise<string | undefined> {
    const team = await this.findTeam(project.teamId);
    return team?.board ?? (account?.config.kind === "jira" ? account.config.projectKey : undefined);
  }

  /** The project's GitLab link (host + path), `null` for a GitHub / remote-less / unknown project. */
  async gitlabLinkFor(projectId: string): Promise<GitlabLink | null> {
    if (!this.projects) return null;
    const project = await this.projects.get(projectId).catch(() => null);
    return project ? resolveGitlabLink(this, project) : null;
  }

  /** The knowledge base a run on this project may read. `null` when there is none. */
  async knowledgeBaseFor(projectId: string): Promise<KnowledgeBaseSource | null> {
    if (!this.projects) return null;
    const project = await this.projects.get(projectId).catch(() => null);
    if (!project) return null;
    return resolveKnowledgeBase(project, await this.findTeam(project.teamId));
  }

  /**
   * Resolve `companyId` to a `Company`, or `null` for "no company" — absent id, OR
   * a dangling id whose company was deleted (`CompaniesStorageService.get` 404s,
   * caught here and folded into the same `null` path; never rethrown, per the
   * Phase 68 cross-cutting "dangling companyId" decision).
   */
  private async findCompany(companyId: string | undefined): Promise<{
    id: string;
    name: string;
    people?: ProjectPerson[];
    budget?: ProjectBudget;
  } | null> {
    if (!companyId) return null;
    return this.companies.get(companyId).catch(() => null);
  }

  /**
   * Resolve `teamId` to a `Team`, or `null` for "no team" — absent id, OR a
   * dangling id whose team was deleted (`TeamsStorageService.get` 404s, caught
   * here and folded into the same `null` path — mirrors {@link findCompany}
   * exactly). A project with no `teamId` never touches `this.teams` at all, so
   * this stays a no-op even when `teams` wasn't supplied to the constructor.
   */
  private async findTeam(teamId: string | undefined): Promise<Team | null> {
    if (!teamId || !this.teams) return null;
    return this.teams.get(teamId).catch(() => null);
  }

  /**
   * The company id this project effectively resolves to, project → team →
   * company (see {@link resolveEffectiveCompanyId}). A project with no team
   * resolves identically to before this phase.
   */
  private async effectiveCompanyId(project: Project): Promise<string | undefined> {
    const team = await this.findTeam(project.teamId);
    return resolveEffectiveCompanyId(project, team);
  }
}
