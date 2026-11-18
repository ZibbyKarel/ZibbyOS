import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  type CreateTeamInput,
  DEFAULT_KB_CONTEXT,
  DEFAULT_KB_ROOT,
  type KnowledgeBaseEntry,
  type KnowledgeBaseSource,
  KnowledgeBaseSourceSchema,
  type Team,
  TeamSchema,
  type UpdateTeamInput,
} from "@zibby/contracts";
import { KbRegistryService } from "../memory/kb-registry.service";
import { ensureDir, safeJson, searchByText, writeFileAtomic } from "../shared/file-storage";
import { TeamConflictError, TeamNotFoundError } from "./teams.errors";

/** DI token carrying the absolute path of the directory that holds the registry. */
export const TEAMS_DIR = "TEAMS_DIR";

/** Manifest file holding the team registry. */
const MANIFEST_FILE = "_teams.json";

/**
 * File-backed persistence for the team registry: a single JSON manifest
 * (`_teams.json`) in a configurable data directory — mirrors
 * `CompaniesStorageService` verbatim, minus the person-roster backfill (a
 * team has no `people` roster in v1). A fresh install starts empty; the
 * manifest is created on the first `create`. The list is kept sorted by id so
 * callers get a stable order. Deleting a team that still has projects
 * pointing at it via `teamId` is allowed (no cascade) — the dangling
 * reference is resolved to "no team" at read time (mirrors the companies
 * Phase 69/70 decision).
 */
@Injectable()
export class TeamsStorageService implements OnModuleInit {
  private readonly dir: string;
  private readonly file: string;
  private readonly logger = new Logger(TeamsStorageService.name);

  constructor(
    @Inject(TEAMS_DIR) dir: string,
    private readonly kbRegistry: KbRegistryService,
  ) {
    this.dir = path.resolve(dir);
    this.file = path.join(this.dir, MANIFEST_FILE);
  }

  /** Boot migration (M5): never fatal — the manifest keeps its `knowledgeBase` until the move succeeds. */
  async onModuleInit(): Promise<void> {
    await this.migrateKnowledgeBases().catch((e: unknown) =>
      this.logger.warn(`team knowledgeBase migration failed: ${String(e)}`),
    );
  }

  /**
   * Move `knowledgeBase` out of `_teams.json` into the mozek registry, then strip it from
   * the manifest. Idempotent: a team that already has a registry entry just gets stripped.
   */
  async migrateKnowledgeBases(): Promise<void> {
    const raw = await fs.readFile(this.file, "utf8").catch(() => null);
    const manifest = raw === null ? null : safeJson(raw);
    if (!Array.isArray(manifest)) return;
    let changed = false;
    for (const entry of manifest as Record<string, unknown>[]) {
      if (!entry || typeof entry !== "object" || !("knowledgeBase" in entry)) continue;
      const source = KnowledgeBaseSourceSchema.safeParse(entry.knowledgeBase);
      const team = TeamSchema.omit({ knowledgeBase: true }).safeParse(entry);
      if (!source.success || !team.success) continue; // leave unparseable data untouched
      if (!(await this.kbRegistry.forTeam(team.data.id))) {
        await this.bindKb(team.data, source.data);
      }
      delete entry.knowledgeBase;
      changed = true;
    }
    if (changed)
      await ensureDir(this.dir).then(() =>
        writeFileAtomic(this.file, `${JSON.stringify(manifest, null, 2)}\n`),
      );
  }

  async list(): Promise<Team[]> {
    const raw = await fs.readFile(this.file, "utf8").catch(() => null);
    if (raw === null) return [];
    const parsed = safeJson(raw);
    if (!Array.isArray(parsed)) return [];
    const kbs = await this.kbRegistry.list();
    // Drop entries that no longer match the schema rather than failing the whole
    // listing (mirrors how the entity/category listings skip corrupt records).
    return parsed
      .flatMap((entry) => {
        const result = TeamSchema.safeParse(entry);
        if (!result.success) return [];
        // `knowledgeBase` is derived from the registry; a legacy manifest value is ignored.
        const team = withoutKb(result.data);
        const kb = kbs.find((k) => k.teamId === team.id);
        return [kb ? { ...team, knowledgeBase: entryToSource(kb) } : team];
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Upsert the registry entry of `team` from a `knowledgeBase` source, keeping curated fields. */
  private async bindKb(
    team: Pick<Team, "id" | "name" | "desc" | "companyId">,
    source: KnowledgeBaseSource,
  ): Promise<void> {
    const byTeam = await this.kbRegistry.forTeam(team.id);
    const sameId = byTeam ? undefined : await this.kbRegistry.get(team.id);
    // Adopt a hand-written entry named after the team; never steal one bound to another team.
    const existing = byTeam ?? (sameId?.teamId === undefined ? sameId : undefined);
    const id = existing?.id ?? (sameId ? `${team.id}-kb` : team.id);
    // Optional keys are spread, not set to `undefined` (YAML cannot dump undefined).
    const kept: Partial<KnowledgeBaseEntry> = { ...existing };
    delete kept.gitRemote;
    delete kept.companyId;
    await this.kbRegistry.upsert({
      domain: "work",
      description: team.desc ?? "",
      ...kept,
      id,
      name: existing?.name ?? team.name,
      path: source.path,
      ...(source.gitRemote ? { gitRemote: source.gitRemote } : {}),
      readOnly: true,
      root: source.root ?? existing?.root ?? DEFAULT_KB_ROOT,
      context: source.context ?? existing?.context ?? DEFAULT_KB_CONTEXT,
      teamId: team.id,
      ...(team.companyId ? { companyId: team.companyId } : {}),
    });
  }

  async get(id: string): Promise<Team> {
    const team = (await this.list()).find((t) => t.id === id);
    if (!team) throw new TeamNotFoundError(id);
    return team;
  }

  /** Free-text search over the registry by id, name and desc. */
  async search(query: string): Promise<Team[]> {
    return searchByText(await this.list(), query, (t) => [t.id, t.name, t.desc, t.slug]);
  }

  async create(input: CreateTeamInput): Promise<Team> {
    const teams = await this.list();
    if (teams.some((t) => t.id === input.id)) {
      throw new TeamConflictError(input.id);
    }
    const team = TeamSchema.parse(input);
    if (team.knowledgeBase) await this.bindKb(team, team.knowledgeBase);
    await this.writeAtomic([...teams, team]);
    return this.get(team.id);
  }

  async update(id: string, patch: UpdateTeamInput): Promise<Team> {
    const teams = await this.list();
    const existing = teams.find((t) => t.id === id);
    if (!existing) throw new TeamNotFoundError(id);
    // `companyId: null` is the explicit "unlink the company" signal — distinct
    // from an ABSENT `companyId` key, which leaves the current link alone (a
    // JSON PATCH body can't otherwise express "clear" since `undefined`-valued
    // keys never survive the wire). Zod's `Team.companyId` itself only ever
    // accepts `string | undefined`, so a present `null` is translated to an
    // explicit-undefined override before parsing; an absent key is left out of
    // the merge entirely so the existing value survives the spread.
    const hasCompanyId = "companyId" in patch;
    // `knowledgeBase: null` is the explicit "clear the knowledge base" signal —
    // distinct from an ABSENT `knowledgeBase` key, which leaves the current
    // value alone (same rationale as `hasCompanyId` above).
    const hasKnowledgeBase = "knowledgeBase" in patch;
    const hasSlug = "slug" in patch; // `slug: null` clears, same as above
    const hasJiraProjectKey = "jiraProjectKey" in patch; // `jiraProjectKey: null` clears
    const { companyId, knowledgeBase, slug, jiraProjectKey, ...rest } = patch;
    const merged = TeamSchema.parse({
      ...existing,
      ...rest,
      ...(hasCompanyId ? { companyId: companyId === null ? undefined : companyId } : {}),
      ...(hasKnowledgeBase
        ? { knowledgeBase: knowledgeBase === null ? undefined : knowledgeBase }
        : {}),
      ...(hasSlug ? { slug: slug === null ? undefined : slug } : {}),
      ...(hasJiraProjectKey
        ? { jiraProjectKey: jiraProjectKey === null ? undefined : jiraProjectKey }
        : {}),
      id: existing.id,
    });
    if (hasKnowledgeBase) {
      if (merged.knowledgeBase) await this.bindKb(merged, merged.knowledgeBase);
      else await this.kbRegistry.removeForTeam(id);
    }
    await this.writeAtomic(teams.map((t) => (t.id === id ? merged : t)));
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const teams = await this.list();
    if (!teams.some((t) => t.id === id)) {
      throw new TeamNotFoundError(id);
    }
    await this.kbRegistry.removeForTeam(id);
    await this.writeAtomic(teams.filter((t) => t.id !== id));
  }

  /** Write via a temp file + atomic rename so a crash can't leave a torn manifest. */
  private async writeAtomic(teams: Team[]): Promise<void> {
    await ensureDir(this.dir);
    // `knowledgeBase` lives in the mozek registry, never in the manifest.
    const stripped = teams.map(withoutKb);
    await writeFileAtomic(this.file, `${JSON.stringify(stripped, null, 2)}\n`);
  }
}

function withoutKb(team: Team): Team {
  const copy = { ...team };
  delete copy.knowledgeBase;
  return copy;
}

/** Registry entry → the API's `Team.knowledgeBase`; `root`/`context` shown only when non-default. */
function entryToSource(kb: KnowledgeBaseEntry): KnowledgeBaseSource {
  return {
    kind: "vault",
    path: kb.path,
    ...(kb.gitRemote ? { gitRemote: kb.gitRemote } : {}),
    readOnly: true,
    ...(kb.root !== DEFAULT_KB_ROOT ? { root: kb.root } : {}),
    ...(kb.context !== DEFAULT_KB_CONTEXT ? { context: kb.context } : {}),
  };
}
