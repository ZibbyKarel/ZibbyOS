import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConnectedService } from "@zibby/contracts";
import { z } from "zod";

const execFileP = promisify(execFile);

export const CONNECTED_SERVICES_DIR = Symbol("CONNECTED_SERVICES_DIR");
export const BROWSER_PROFILES_DIR = Symbol("BROWSER_PROFILES_DIR");
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
  profile: z
    .string()
    .regex(/^[A-Za-z0-9._-]+$/)
    .refine((p) => p !== "." && p !== "..", "profile must be a plain directory name"),
  authCookies: z.array(z.object({ host: z.string().min(1), names: z.array(z.string().min(1)) })),
});
export type ServiceDefinition = z.infer<typeof DefinitionSchema>;

export class ConnectedServiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Connected service "${id}" not found`);
  }
}

/** Chrome `expires_utc`: microseconds since 1601-01-01. */
const chromeToUnixMs = (v: number) => v / 1000 - 11644473600000;

/**
 * True when the profile's cookie DB holds a persistent, unexpired auth cookie.
 * Reads via the system sqlite3 (read-only, immutable: Chrome may hold the lock);
 * any failure (no DB, no sqlite3) reads as disconnected; `onError` hears all but a missing DB.
 */
export async function isConnected(
  profilePath: string,
  authCookies: ServiceDefinition["authCookies"],
  now = Date.now(),
  onError?: (error: unknown) => void,
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
        authCookies.some(
          (a) =>
            r.host_key.replace(/^\./, "") === a.host.replace(/^\./, "") && a.names.includes(r.name),
        ),
    );
  } catch (error) {
    // No cookie DB yet = never signed in. Anything else (sqlite3, schema change) is logged.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") onError?.(error);
    return false;
  }
}

@Injectable()
export class ConnectedServicesService {
  private readonly logger = new Logger(ConnectedServicesService.name);

  constructor(
    @Inject(CONNECTED_SERVICES_DIR) private readonly dir: string,
    @Inject(BROWSER_PROFILES_DIR) private readonly profilesDir: string,
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
        defs.push(DefinitionSchema.parse(raw));
      } catch (error) {
        this.logger.warn(`Skipping invalid connected-service definition ${file}: ${String(error)}`);
      }
    }
    return defs;
  }

  private async toService(def: ServiceDefinition): Promise<ConnectedService> {
    const { authCookies, ...rest } = def;
    const connected = await isConnected(
      path.join(this.profilesDir, def.profile),
      authCookies,
      Date.now(),
      (error) => this.logger.warn(`Cookie check failed for ${def.id}: ${String(error)}`),
    );
    return { ...rest, status: connected ? "connected" : "disconnected" };
  }

  async list(): Promise<ConnectedService[]> {
    return Promise.all((await this.loadDefinitions()).map((d) => this.toService(d)));
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
