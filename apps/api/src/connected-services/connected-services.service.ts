import { execFile } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ConnectedService,
  CreateConnectedService,
  UpdateConnectedService,
} from "@zibby/contracts";
import { z } from "zod";

const execFileP = promisify(execFile);

export const CONNECTED_SERVICES_DIR = Symbol("CONNECTED_SERVICES_DIR");
export const BROWSER_PROFILES_DIR = Symbol("BROWSER_PROFILES_DIR");
export const MCP_SERVERS_DIR = Symbol("MCP_SERVERS_DIR");
export const CHROME_LAUNCHER = Symbol("CHROME_LAUNCHER");

/** Opens plain system Chrome (not Playwright) with the given args. */
export type ChromeLauncher = (args: string[]) => Promise<void>;

export const openChrome: ChromeLauncher = async (args) => {
  await execFileP("open", ["-na", "Google Chrome", "--args", ...args]);
};

const DefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  landingUrl: z.string().url(),
  loginUrl: z.string().url(),
  iconUrl: z.string().url().optional(),
  profile: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .refine((p) => p !== "." && p !== "..", "profile must be a plain directory name"),
  authCookies: z.array(z.object({ host: z.string().min(1), names: z.array(z.string().min(1)) })),
  /** Id of the MCP server file this service generated; only that one is removed on delete. */
  mcpServer: z
    .string()
    .regex(/^playwright-[a-z0-9-]+$/)
    .optional(),
});
export type ServiceDefinition = z.infer<typeof DefinitionSchema>;

export class ConnectedServiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Connected service "${id}" not found`);
  }
}

export class ConnectedServiceExistsError extends Error {
  constructor(id: string) {
    super(`Connected service "${id}" already exists`);
  }
}

/** Chrome `expires_utc`: microseconds since 1601-01-01. */
const chromeToUnixMs = (v: number) => v / 1000 - 11644473600000;

/**
 * True when the profile's cookie DB holds a persistent, unexpired auth cookie. With no
 * `authCookies` listed, any persistent unexpired cookie on one of `hosts` (or a subdomain) counts.
 * Reads via the system sqlite3 (read-only, immutable: Chrome may hold the lock);
 * any failure (no DB, no sqlite3) reads as disconnected; `onError` hears all but a missing DB.
 */
export async function isConnected(
  profilePath: string,
  authCookies: ServiceDefinition["authCookies"],
  now = Date.now(),
  onError?: (error: unknown) => void,
  hosts: string[] = [],
): Promise<boolean> {
  const db = path.join(profilePath, "Default", "Cookies");
  try {
    await fs.access(db);
    // `?` and `#` would end the URI path early; escape them.
    const uri = `file:${db.replace(/%/g, "%25").replace(/\?/g, "%3f").replace(/#/g, "%23")}?immutable=1`;
    const { stdout } = await execFileP("/usr/bin/sqlite3", [
      "-readonly",
      "-json",
      uri,
      "select host_key, name, expires_utc, has_expires from cookies",
    ]);
    if (!stdout.trim()) return false;
    const rows = JSON.parse(stdout) as {
      host_key: string;
      name: string;
      expires_utc: number;
      has_expires: number;
    }[];
    return rows.some(
      (r) =>
        r.has_expires === 1 &&
        chromeToUnixMs(r.expires_utc) > now &&
        (authCookies.length
          ? authCookies.some(
              (a) =>
                r.host_key.replace(/^\./, "") === a.host.replace(/^\./, "") &&
                a.names.includes(r.name),
            )
          : // ponytail: any long-lived cookie counts (a consent cookie reads as signed in);
            // fill in the definition's `authCookies` for an exact check.
            hosts.some((h) => {
              const host = r.host_key.replace(/^\./, "");
              return host === h || host.endsWith(`.${h}`);
            })),
    );
  } catch (error) {
    // No cookie DB yet = never signed in. Anything else (sqlite3, schema change) is logged.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") onError?.(error);
    return false;
  }
}

/** `playwright-mcp` next to the running node (nvm layout, as in the hand-made recipes), else from PATH. */
function playwrightMcpCommand(): string {
  const sibling = path.join(path.dirname(process.execPath), "playwright-mcp");
  return existsSync(sibling) ? sibling : "playwright-mcp";
}

/** The file each loaded definition came from, so an edit rewrites it in place. */
const sourceFile = new WeakMap<ServiceDefinition, string>();

@Injectable()
export class ConnectedServicesService {
  private readonly logger = new Logger(ConnectedServicesService.name);

  constructor(
    @Inject(CONNECTED_SERVICES_DIR) private readonly dir: string,
    @Inject(BROWSER_PROFILES_DIR) private readonly profilesDir: string,
    @Inject(MCP_SERVERS_DIR) private readonly mcpDir: string,
    @Inject(CHROME_LAUNCHER) private readonly launch: ChromeLauncher,
  ) {}

  /** Valid definitions from `dir`; invalid files are logged and skipped, a missing dir is empty. */
  async loadDefinitions(): Promise<ServiceDefinition[]> {
    let files: string[];
    try {
      files = (await fs.readdir(this.dir)).filter((f) => f.endsWith(".json")).sort();
    } catch {
      return [];
    }
    const defs: ServiceDefinition[] = [];
    for (const file of files) {
      try {
        const raw = JSON.parse(await fs.readFile(path.join(this.dir, file), "utf8"));
        const def = DefinitionSchema.parse(raw);
        sourceFile.set(def, file);
        defs.push(def);
      } catch (error) {
        this.logger.warn(`Skipping invalid connected-service definition ${file}: ${String(error)}`);
      }
    }
    return defs;
  }

  private async toService(def: ServiceDefinition): Promise<ConnectedService> {
    const { authCookies, mcpServer, ...rest } = def;
    void mcpServer; // internal bookkeeping, not part of the API shape
    const connected = await isConnected(
      path.join(this.profilesDir, def.profile),
      authCookies,
      Date.now(),
      (error) => this.logger.warn(`Cookie check failed for ${def.id}: ${String(error)}`),
      [new URL(def.loginUrl).hostname, new URL(def.landingUrl).hostname],
    );
    return { ...rest, authCookies, status: connected ? "connected" : "disconnected" };
  }

  async list(): Promise<ConnectedService[]> {
    return Promise.all((await this.loadDefinitions()).map((d) => this.toService(d)));
  }

  /** Validates, then writes atomically (tmp + rename) to `dir/<file>`. */
  private async write(def: ServiceDefinition, name: string): Promise<ConnectedService> {
    const valid = DefinitionSchema.parse(def);
    await fs.mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, name);
    await fs.writeFile(`${file}.tmp`, `${JSON.stringify(valid, null, 2)}\n`);
    await fs.rename(`${file}.tmp`, file);
    return this.toService(valid);
  }

  /** Adds a service: id/profile = slug of the name, landingUrl defaults to the login URL's origin. */
  async create(input: CreateConnectedService): Promise<ConnectedService> {
    const id = input.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const name = `${id}.json`;
    const taken = existsSync(path.join(this.dir, name));
    if (taken || (await this.loadDefinitions()).some((d) => d.id === id)) {
      throw new ConnectedServiceExistsError(id);
    }
    const mcpServer = `playwright-${id}`;
    const mcpFile = path.join(this.mcpDir, `${mcpServer}.json`);
    // An existing MCP file (hand-written or another service's) is never overwritten: the
    // definition is still created, just without ownership of that file.
    const ownsMcp = await this.writeMcpServer(mcpFile, mcpServer, input.name, id);
    try {
      return await this.write(
        {
          id,
          name: input.name,
          landingUrl: input.landingUrl ?? new URL(input.loginUrl).origin,
          loginUrl: input.loginUrl,
          ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
          profile: id,
          authCookies: input.authCookies ?? [],
          ...(ownsMcp ? { mcpServer } : {}),
        },
        name,
      );
    } catch (err) {
      // No definition owns the MCP file we just generated, so remove() could never clean it up.
      if (ownsMcp) await fs.rm(mcpFile, { force: true });
      throw err;
    }
  }

  /** Writes the grantOnly Playwright MCP server for a service's profile; false when the file already exists. */
  private async writeMcpServer(
    file: string,
    mcpServer: string,
    name: string,
    profile: string,
  ): Promise<boolean> {
    if (existsSync(file)) {
      this.logger.warn(`MCP server file ${mcpServer}.json exists, left untouched`);
      return false;
    }
    const server = {
      id: mcpServer,
      name: `Playwright (${name} profile)`,
      desc: `Headed browser with a persistent profile that stays signed in to ${name}. The operator signs in once in this profile; agents never enter credentials.`,
      type: "stdio",
      command: playwrightMcpCommand(),
      args: [
        "--user-data-dir",
        path.resolve(this.profilesDir, profile),
        "--allow-unrestricted-file-access",
      ],
      enabled: true,
      grantOnly: true,
    };
    await fs.mkdir(this.mcpDir, { recursive: true });
    // `wx` = never clobber a file that appeared since the check above.
    await fs.writeFile(file, `${JSON.stringify(server, null, 2)}\n`, { flag: "wx" });
    return true;
  }

  /** Removes the definition and the MCP server file it generated; the browser profile stays. */
  async remove(id: string): Promise<void> {
    const def = (await this.loadDefinitions()).find((d) => d.id === id);
    if (!def) throw new ConnectedServiceNotFoundError(id);
    if (def.mcpServer)
      await fs.rm(path.join(this.mcpDir, `${def.mcpServer}.json`), { force: true });
    await fs.rm(path.join(this.dir, sourceFile.get(def) ?? `${def.id}.json`));
  }

  /** Edits name/URLs/icon/authCookies; id and profile never change. `iconUrl: null` clears it. */
  async update(id: string, patch: UpdateConnectedService): Promise<ConnectedService> {
    const def = (await this.loadDefinitions()).find((d) => d.id === id);
    if (!def) throw new ConnectedServiceNotFoundError(id);
    const { iconUrl, ...rest } = patch;
    const next: ServiceDefinition = { ...def, ...rest };
    if (iconUrl === null) delete next.iconUrl;
    else if (iconUrl) next.iconUrl = iconUrl;
    return this.write(
      { ...next, id: def.id, profile: def.profile },
      sourceFile.get(def) ?? `${def.id}.json`,
    );
  }

  async connect(id: string): Promise<ConnectedService> {
    const def = (await this.loadDefinitions()).find((d) => d.id === id);
    if (!def) throw new ConnectedServiceNotFoundError(id);
    const profilePath = path.resolve(this.profilesDir, def.profile);
    await fs.mkdir(profilePath, { recursive: true });
    // Same cookie-encryption key as the agents' Playwright Chrome (playwright-mcp launches
    // with a mock keychain); with the real Keychain key the agents could not decrypt the login.
    await this.launch([
      "--use-mock-keychain",
      "--password-store=basic",
      `--user-data-dir=${profilePath}`,
      def.loginUrl,
    ]);
    return this.toService(def);
  }
}
