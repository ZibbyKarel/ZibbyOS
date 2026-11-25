import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * One-shot, idempotent data migration for the accounts model: an integration is an
 * account owned by a company or by the operator (personal) — never by a project —
 * and stores no repo; a team's `jiraProjectKey` is its `board`.
 *
 * Runs at API boot (see `main.ts`) BEFORE any Nest module reads the data root. No
 * integration id changes (ids key credentials, channel items, cursors, roadmap ids),
 * and nothing is merged. Steps (the marker is written last, so an interrupted run
 * simply repeats):
 *
 *  0. Back up `integrations/`, `_projects.json` and `_teams.json`.
 *  1. Project-owned integration → its project's company; a mailbox / calendar, or a
 *     project without a company → the operator (no `companyId`).
 *  2. `config.repo` is dropped. The owning project gets a `gitRemote` when it had none,
 *     and the poll cursors move to the per-repo slot the repo-less watcher reads, so
 *     the first poll after the migration re-ingests nothing.
 *  3. Team `jiraProjectKey` → `board`; a team without one takes the single Jira
 *     project key its projects' routing rules agree on.
 */

export const ACCOUNTS_MIGRATION_MARKER = ".accounts-migration.done";
export const ACCOUNTS_MIGRATION_BACKUP = ".accounts-migration-backup";

/** Kinds that are the operator's own even when they hung on a company's project. */
const PERSONAL_KINDS = new Set(["email", "calendar"]);

export interface AccountsMigrationResult {
  /** True when the marker already existed (nothing was done). */
  skipped: boolean;
  /** Integration files rewritten. */
  accounts: number;
  /** Teams whose board was renamed or seeded. */
  teams: number;
}

type Json = Record<string, unknown>;

const exists = (p: string): Promise<boolean> =>
  fs.access(p).then(
    () => true,
    () => false,
  );

async function writeAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, file);
}

const writeJson = (file: string, value: unknown): Promise<void> =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);

async function readJson(file: string): Promise<unknown> {
  const raw = await fs.readFile(file, "utf8").catch(() => null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/** `{ host, path }` of a git remote — same shapes as contracts' `gitRemoteInfo`. */
function remoteInfo(remote: string | undefined): { host: string; path: string } | null {
  if (!remote) return null;
  const m =
    /^(?:[\w.-]+@([\w.-]+):|(?:https|ssh):\/\/(?:[^/@]+@)?([^/:]+)(?::\d+)?\/)(.+?)(?:\.git)?\/?$/i.exec(
      remote.trim(),
    );
  const host = m?.[1] ?? m?.[2];
  const repoPath = m?.[3]?.replace(/^\/+/, "");
  return host && repoPath ? { host: host.toLowerCase(), path: repoPath } : null;
}

/** The key the repo-less watcher uses for `repo` (GitHub lowercases, GitLab keeps the remote's case). */
function repoKey(kind: string, host: string, repo: string, gitRemote: string | undefined): string {
  if (kind === "github") return repo.toLowerCase();
  const info = remoteInfo(gitRemote);
  return info && info.host === host.toLowerCase() ? info.path : repo;
}

/** `cursor.json` `{ cursor }` → adds `repos[key]` (the single cursor stays, harmlessly). */
async function moveChannelCursor(root: string, id: string, key: string): Promise<void> {
  const file = path.join(root, "channels", id, "cursor.json");
  const parsed = await readJson(file);
  if (!isObject(parsed) || parsed.cursor === undefined) return;
  const repos = isObject(parsed.repos) ? parsed.repos : {};
  if (repos[key] !== undefined) return;
  await writeJson(file, { ...parsed, repos: { ...repos, [key]: parsed.cursor } });
}

/** `monitors/{cursors,status}/<id>--<adapter>` → `<id>--<repo>--<adapter>` (the per-repo target key). */
async function moveMonitorFiles(root: string, id: string, key: string): Promise<void> {
  const target = `${id}--${key.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  for (const dir of ["cursors", "status"]) {
    const abs = path.join(root, "monitors", dir);
    for (const name of await fs.readdir(abs).catch(() => [] as string[])) {
      if (!name.startsWith(`${id}--`)) continue;
      const rest = name.slice(id.length + 2);
      if (rest.includes("--")) continue; // already a per-repo file
      const dst = path.join(abs, `${target}--${rest}`);
      if (!(await exists(dst))) await fs.rename(path.join(abs, name), dst);
    }
  }
}

export async function migrateAccounts(
  root: string,
  log: (msg: string) => void = () => undefined,
): Promise<AccountsMigrationResult> {
  const none = { skipped: true, accounts: 0, teams: 0 };
  const marker = path.join(root, ACCOUNTS_MIGRATION_MARKER);
  if ((await exists(marker)) || !(await exists(root))) return none;

  const integrationsDir = path.join(root, "integrations");
  const projectsFile = path.join(root, "projects", "_projects.json");
  const teamsFile = path.join(root, "teams", "_teams.json");

  // 0. Backup — once; a re-run after an interruption must not overwrite the originals.
  const backup = path.join(root, ACCOUNTS_MIGRATION_BACKUP);
  if (!(await exists(backup))) {
    const tmp = `${backup}.tmp`;
    await fs.rm(tmp, { recursive: true, force: true });
    await fs.mkdir(tmp, { recursive: true });
    if (await exists(integrationsDir))
      await fs.cp(integrationsDir, path.join(tmp, "integrations"), { recursive: true });
    for (const file of [projectsFile, teamsFile])
      if (await exists(file)) await fs.copyFile(file, path.join(tmp, path.basename(file)));
    await fs.rename(tmp, backup);
  }

  const projectsRaw = await readJson(projectsFile);
  const projects = Array.isArray(projectsRaw) ? projectsRaw.filter(isObject) : [];
  const teamsRaw = await readJson(teamsFile);
  const teams = Array.isArray(teamsRaw) ? teamsRaw.filter(isObject) : [];
  const teamCompany = new Map(teams.map((t) => [str(t.id), str(t.companyId)]));
  let projectsDirty = false;

  // 1 + 2. Integrations.
  let accounts = 0;
  for (const name of await fs.readdir(integrationsDir).catch(() => [] as string[])) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(integrationsDir, name);
    const entity = await readJson(file);
    if (!isObject(entity)) continue;
    const id = str(entity.id) ?? name.slice(0, -".json".length);
    const kind = str(entity.kind) ?? "";
    const config = isObject(entity.config) ? entity.config : undefined;
    const projectId = str(entity.projectId);
    const repo = kind === "github" || kind === "gitlab" ? str(config?.repo) : undefined;
    if (projectId === undefined && repo === undefined) continue;

    const project = projects.find((p) => p.id === projectId);
    if (projectId !== undefined) {
      delete entity.projectId;
      const companyId =
        str(project?.companyId) ?? (project ? teamCompany.get(str(project.teamId)) : undefined);
      if (companyId && !PERSONAL_KINDS.has(kind) && entity.companyId === undefined)
        entity.companyId = companyId;
      log(`account ${id}: project ${projectId} → ${str(entity.companyId) ?? "operator"}`);
    }

    if (repo !== undefined && config) {
      delete config.repo;
      const host = kind === "github" ? "github.com" : (str(config.host) ?? "");
      if (project && !str(project.gitRemote) && host) {
        project.gitRemote = `git@${host}:${repo}.git`;
        projectsDirty = true;
        log(`project ${String(project.id)}: gitRemote ← ${String(project.gitRemote)}`);
      }
      const key = repoKey(kind, host, repo, str(project?.gitRemote));
      await moveChannelCursor(root, id, key);
      await moveMonitorFiles(root, id, key);
    }

    await writeJson(file, entity);
    accounts += 1;
  }
  if (projectsDirty) await writeJson(projectsFile, projectsRaw);

  // 3. Team board.
  let teamCount = 0;
  for (const team of teams) {
    const before = JSON.stringify(team);
    if (team.jiraProjectKey !== undefined) {
      team.board ??= team.jiraProjectKey;
      delete team.jiraProjectKey;
    }
    if (team.board === undefined) {
      const keys = new Set<string>();
      for (const project of projects) {
        if (project.teamId !== team.id || !Array.isArray(project.integrationRouting)) continue;
        for (const rule of project.integrationRouting) {
          const match = isObject(rule) && isObject(rule.match) ? rule.match : undefined;
          const key = match?.kind === "jira" ? str(match.projectKey) : undefined;
          if (key) keys.add(key.toUpperCase());
        }
      }
      const [only] = [...keys];
      if (keys.size === 1 && only) team.board = only;
    }
    if (JSON.stringify(team) !== before) {
      teamCount += 1;
      log(`team ${String(team.id)}: board = ${String(team.board)}`);
    }
  }
  if (teamCount > 0) await writeJson(teamsFile, teamsRaw);

  await fs.writeFile(marker, `${new Date().toISOString()}\n`, "utf8");
  log(`accounts migration: ${accounts} account(s), ${teamCount} team(s)`);
  return { skipped: false, accounts, teams: teamCount };
}
