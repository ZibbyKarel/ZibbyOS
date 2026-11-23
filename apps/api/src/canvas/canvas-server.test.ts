import { promises as fs } from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanvasServer, injectCanvasHost } from "./canvas-server";
import { CanvasStore } from "./canvas.store";

describe("canvas server", () => {
  let dir: string;
  let server: ReturnType<typeof createCanvasServer>;
  let id: string;
  const host = () => `${id}.canvas.localhost:3334`;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-server-"));
    const store = new CanvasStore(dir);
    id = (await store.publish({ title: "T", html: "<html><head><title>x</title></head>v1" })).id;
    await store.publish({ title: "T", html: "<p>v2 no head</p>", id });
    server = createCanvasServer(store);
  });
  afterAll(() => fs.rm(dir, { recursive: true, force: true }));

  it("host mode: current and explicit versions", async () => {
    const cur = await request(server).get("/").set("Host", host()).expect(200);
    expect(cur.text).toContain("v2 no head");
    const v1 = await request(server).get("/v1/").set("Host", host()).expect(200);
    expect(v1.text).toContain("v1");
    await request(server).get("/v1").set("Host", host()).expect(200);
    const csp = cur.headers["content-security-policy"] as string;
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toContain("sandbox");
    expect(cur.headers["x-content-type-options"]).toBe("nosniff");
    expect(cur.headers["referrer-policy"]).toBe("no-referrer");
    expect(cur.headers["cache-control"]).toBe("no-store");
  });

  it("path mode adds the sandbox directive", async () => {
    const cur = await request(server).get(`/a/${id}/`).set("Host", "localhost:3334").expect(200);
    expect(cur.headers["content-security-policy"]).toContain(
      "sandbox allow-scripts allow-modals allow-pointer-lock",
    );
    await request(server).get(`/a/${id}/v1/`).set("Host", "localhost:3334").expect(200);
    await request(server).get(`/a/${id}`).set("Host", "localhost:3334").expect(200);
  });

  it("injects host files with and without <head>", async () => {
    const withHead = (await request(server).get("/v1/").set("Host", host())).text;
    expect(withHead).toMatch(/<head><meta name="color-scheme"[^]*canvas\.js"><\/script><title>/);
    const noHead = (await request(server).get("/").set("Host", host())).text;
    expect(noHead.startsWith("<head><meta")).toBe(true);
    expect(injectCanvasHost("<html lang=en><body/>")).toMatch(/^<html lang=en><head><meta/);
    expect(injectCanvasHost("<header>x</header>")).toMatch(/^<head><meta/);
  });

  it("serves the two host assets", async () => {
    const js = await request(server).get("/__zibby/canvas.js").expect(200);
    expect(js.headers["content-type"]).toContain("javascript");
    expect(js.text).toContain("window === window.top");
    const css = await request(server).get("/__zibby/canvas.css").expect(200);
    expect(css.text).toContain("--ink");
    await request(server).get("/__zibby/other.js").expect(404);
  });

  it("404s traversal, bad ids, unknown versions and other files", async () => {
    const h = "localhost:3334";
    for (const p of [
      "/a/../x",
      `/a/${id}/%2e%2e/`,
      "/a/short/",
      `/a/${id.toUpperCase()}/`,
      `/a/${id}/v99/`,
      `/a/${id}/v0/`,
      `/a/${id}/index.html`,
      `/a/${id}/v1/meta.json`,
      "/",
      "/etc/passwd",
    ])
      await request(server).get(p).set("Host", h).expect(404);
    await request(server).get("/v9/").set("Host", host()).expect(404);
    await request(server).get("/meta.json").set("Host", host()).expect(404);
    await request(server).get("/").set("Host", "zzzzzzzzzz.canvas.localhost:3334").expect(404);
  });

  it("404s raw (un-normalised) traversal paths", async () => {
    const addr = await new Promise<number>((r) =>
      server.listen(0, () => r((server.address() as AddressInfo).port)),
    );
    const get = (p: string) =>
      new Promise<number>((resolve) =>
        http.get({ port: addr, path: p, headers: { host: "localhost" } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        }),
      );
    expect(await get(`/a/${id}/../${id}/`)).toBe(404);
    expect(await get("/a/../x")).toBe(404);
    expect(await get(`/a/${id}/v1/../../x`)).toBe(404);
    await new Promise((r) => server.close(r));
  });

  it("rejects non GET/HEAD with 405", async () => {
    const res = await request(server).post("/").set("Host", host()).expect(405);
    expect(res.headers["allow"]).toBe("GET, HEAD");
    await request(server).head("/").set("Host", host()).expect(200);
  });
});
