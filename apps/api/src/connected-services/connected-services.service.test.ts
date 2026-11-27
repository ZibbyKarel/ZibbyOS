import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConnectedServiceExistsError,
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
  it("with no authCookies, any persistent cookie on the hosts (or a subdomain) counts", async () => {
    const hosts = ["shop.example"];
    const sub = makeProfile("a", [[".www.shop.example", "x", future, 1]]);
    expect(await isConnected(sub, [], NOW, undefined, hosts)).toBe(true);
    const session = makeProfile("b", [["shop.example", "x", 0, 0]]);
    expect(await isConnected(session, [], NOW, undefined, hosts)).toBe(false);
    const other = makeProfile("c", [[".notshop.example", "x", future, 1]]);
    expect(await isConnected(other, [], NOW, undefined, hosts)).toBe(false);
  });
  it("hosts never widen a service that lists authCookies", async () => {
    const p = makeProfile("a", [[".amazon.com", "other", future, 1]]);
    expect(await isConnected(p, AUTH, NOW, undefined, ["amazon.com"])).toBe(false);
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
  const mcpDir = () => path.join(tmp, "mcp");
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
      s: new ConnectedServicesService(dir, path.join(tmp, "profiles"), mcpDir(), launch),
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
        authCookies: AUTH,
        status: "disconnected",
      },
    ]);
  });

  it("returns an empty list when the dir is missing", async () => {
    const s = new ConnectedServicesService(
      path.join(tmp, "none"),
      tmp,
      path.join(tmp, "mcp"),
      vi.fn(),
    );
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

  it("create writes a valid definition with a slug id and the login origin as landing", async () => {
    const { s } = svc();
    const res = await s.create({ name: "Šumava Shop!", loginUrl: "https://shop.example/a/login" });
    expect(res).toEqual({
      id: "sumava-shop",
      name: "Šumava Shop!",
      landingUrl: "https://shop.example",
      loginUrl: "https://shop.example/a/login",
      profile: "sumava-shop",
      authCookies: [],
      status: "disconnected",
    });
    const mcp = JSON.parse(
      readFileSync(path.join(mcpDir(), "playwright-sumava-shop.json"), "utf8"),
    );
    expect(mcp).toMatchObject({
      id: "playwright-sumava-shop",
      type: "stdio",
      enabled: true,
      grantOnly: true,
      args: [
        "--user-data-dir",
        path.join(tmp, "profiles", "sumava-shop"),
        "--allow-unrestricted-file-access",
      ],
    });
    const file = JSON.parse(readFileSync(path.join(tmp, "defs", "sumava-shop.json"), "utf8"));
    expect(file.authCookies).toEqual([]);
    expect((await s.list()).map((d) => d.id)).toEqual(["kdp", "sumava-shop"]);
  });

  it("create rejects an id clash", async () => {
    const { s } = svc();
    await expect(
      s.create({ name: "KDP", loginUrl: "https://x.example/login" }),
    ).rejects.toBeInstanceOf(ConnectedServiceExistsError);
  });

  it("update keeps id, profile and authCookies; null clears the icon", async () => {
    const { s } = svc();
    const set = await s.update("kdp", {
      name: "KDP 2",
      iconUrl: "https://kdp.amazon.com/i.png",
      // @ts-expect-error — not part of the patch; must be ignored
      profile: "hijack",
    });
    expect(set).toMatchObject({ id: "kdp", name: "KDP 2", profile: "kdp" });
    expect(set.iconUrl).toBe("https://kdp.amazon.com/i.png");
    const cleared = await s.update("kdp", { iconUrl: null });
    expect(cleared.iconUrl).toBeUndefined();
    const file = JSON.parse(readFileSync(path.join(tmp, "defs", "kdp.json"), "utf8"));
    expect(file).toEqual({ ...def, name: "KDP 2" });
  });

  it("update rejects an unknown id", async () => {
    const { s } = svc();
    await expect(s.update("nope", { name: "x" })).rejects.toBeInstanceOf(
      ConnectedServiceNotFoundError,
    );
  });

  it("create stores authCookies", async () => {
    const { s } = svc();
    const cookies = [{ host: ".etsy.com", names: ["uaid"] }];
    const res = await s.create({
      name: "Etsy",
      loginUrl: "https://www.etsy.com/signin",
      authCookies: cookies,
    });
    expect(res.authCookies).toEqual(cookies);
  });

  it("create never overwrites an existing MCP file and does not claim it", async () => {
    const { s } = svc();
    mkdirSync(mcpDir(), { recursive: true });
    const file = path.join(mcpDir(), "playwright-etsy.json");
    writeFileSync(file, "hand-made");
    await s.create({ name: "Etsy", loginUrl: "https://www.etsy.com/signin" });
    expect(readFileSync(file, "utf8")).toBe("hand-made");
    await s.remove("etsy");
    expect(readFileSync(file, "utf8")).toBe("hand-made");
  });

  it("remove deletes the definition and its generated MCP file but keeps the profile", async () => {
    const { s } = svc();
    await s.create({ name: "Etsy", loginUrl: "https://www.etsy.com/signin" });
    const profile = path.join(tmp, "profiles", "etsy");
    mkdirSync(profile, { recursive: true });
    await s.remove("etsy");
    expect(existsSync(path.join(tmp, "defs", "etsy.json"))).toBe(false);
    expect(existsSync(path.join(mcpDir(), "playwright-etsy.json"))).toBe(false);
    expect(existsSync(profile)).toBe(true);
    expect((await s.list()).map((d) => d.id)).toEqual(["kdp"]);
  });

  it("remove leaves the MCP file of a hand-written definition and rejects unknown ids", async () => {
    const { s } = svc();
    mkdirSync(mcpDir(), { recursive: true });
    writeFileSync(path.join(mcpDir(), "playwright-kdp.json"), "{}");
    await s.remove("kdp");
    expect(existsSync(path.join(mcpDir(), "playwright-kdp.json"))).toBe(true);
    await expect(s.remove("kdp")).rejects.toBeInstanceOf(ConnectedServiceNotFoundError);
  });

  it("update replaces authCookies", async () => {
    const { s } = svc();
    const res = await s.update("kdp", { authCookies: [] });
    expect(res.authCookies).toEqual([]);
  });
});
