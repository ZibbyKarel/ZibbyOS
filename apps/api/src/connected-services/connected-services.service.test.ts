import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectedServiceNotFoundError,
  ConnectedServicesService,
  isConnected,
} from "./connected-services.service";

const NOW = Date.UTC(2026, 10, 20);
const toChrome = (unixMs: number) => (unixMs + 11644473600000) * 1000;
const AUTH = [{ host: ".amazon.com", names: ["at-main"] }];

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "connsvc-"));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function makeProfile(profile: string, rows: [string, string, number, number][]): string {
  const dir = path.join(tmp, "profiles", profile);
  mkdirSync(path.join(dir, "Default"), { recursive: true });
  const sql =
    "create table cookies(host_key text, name text, expires_utc integer, has_expires integer);" +
    rows.map(([h, n, e, x]) => `insert into cookies values('${h}','${n}',${e},${x});`).join("");
  execFileSync("/usr/bin/sqlite3", [path.join(dir, "Default", "Cookies"), sql]);
  return dir;
}

describe("isConnected", () => {
  const future = toChrome(NOW + 86_400_000);
  it("is connected for a persistent unexpired auth cookie", async () => {
    const p = makeProfile("a", [[".amazon.com", "at-main", future, 1]]);
    expect(await isConnected(p, AUTH, NOW)).toBe(true);
  });
  it("accepts the host without the leading dot", async () => {
    const p = makeProfile("a", [["amazon.com", "at-main", future, 1]]);
    expect(await isConnected(p, AUTH, NOW)).toBe(true);
  });
  it("is disconnected when expired", async () => {
    const p = makeProfile("a", [[".amazon.com", "at-main", toChrome(NOW - 1000), 1]]);
    expect(await isConnected(p, AUTH, NOW)).toBe(false);
  });
  it("ignores session-only cookies", async () => {
    const p = makeProfile("a", [[".amazon.com", "at-main", 0, 0]]);
    expect(await isConnected(p, AUTH, NOW)).toBe(false);
  });
  it("ignores wrong host or wrong name", async () => {
    const p = makeProfile("a", [
      [".evil.com", "at-main", future, 1],
      [".amazon.com", "other", future, 1],
    ]);
    expect(await isConnected(p, AUTH, NOW)).toBe(false);
  });
  it("is disconnected when the DB is missing", async () => {
    expect(await isConnected(path.join(tmp, "nope"), AUTH, NOW)).toBe(false);
  });
});

describe("ConnectedServicesService", () => {
  const def = {
    id: "kdp",
    name: "Amazon KDP",
    landingUrl: "https://kdp.amazon.com",
    loginUrl: "https://kdp.amazon.com/signin",
    profile: "kdp",
    authCookies: AUTH,
  };
  function svc(launch = vi.fn().mockResolvedValue(undefined)) {
    const dir = path.join(tmp, "defs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "kdp.json"), JSON.stringify(def));
    writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ id: "x" }));
    writeFileSync(path.join(dir, "worse.json"), "{not json");
    writeFileSync(
      path.join(dir, "evil.json"),
      JSON.stringify({ ...def, id: "e", profile: "../x" }),
    );
    return {
      launch,
      s: new ConnectedServicesService(dir, path.join(tmp, "profiles"), launch),
    };
  }

  it("loads valid definitions, skipping invalid ones", async () => {
    const { s } = svc();
    const list = await s.list();
    expect(list).toEqual([
      {
        id: "kdp",
        name: "Amazon KDP",
        landingUrl: def.landingUrl,
        loginUrl: def.loginUrl,
        profile: "kdp",
        status: "disconnected",
      },
    ]);
  });

  it("returns an empty list when the dir is missing", async () => {
    const s = new ConnectedServicesService(path.join(tmp, "none"), tmp, vi.fn());
    expect(await s.list()).toEqual([]);
  });

  it("connect launches Chrome on the profile at the login URL", async () => {
    const { s, launch } = svc();
    const res = await s.connect("kdp");
    const profile = path.join(tmp, "profiles", "kdp");
    expect(launch).toHaveBeenCalledWith([
      "--use-mock-keychain",
      "--password-store=basic",
      `--user-data-dir=${profile}`,
      def.loginUrl,
    ]);
    expect(existsSync(profile)).toBe(true);
    expect(res.id).toBe("kdp");
  });

  it("connect rejects an unknown id", async () => {
    const { s, launch } = svc();
    await expect(s.connect("nope")).rejects.toBeInstanceOf(ConnectedServiceNotFoundError);
    expect(launch).not.toHaveBeenCalled();
  });
});
