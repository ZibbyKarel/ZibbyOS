import { describe, expect, it } from "vitest";
import {
  CanvasFetchError,
  type CanvasHop,
  type CanvasLookup,
  canvasFetch,
  isBlockedIp,
} from "./canvas-fetch";

const lookupTo =
  (address: string, family = 4): CanvasLookup =>
  (_h, _o, cb) =>
    cb(null, [{ address, family }]);

const opts = (
  hosts: string[],
  extra: Partial<Parameters<typeof canvasFetch>[1]> = {},
): Parameters<typeof canvasFetch>[1] => ({
  allowedOrigins: hosts.map((h) => `https://${h}`),
  granted: hosts.map((h) => `https://${h}`),
  lookup: lookupTo("93.184.216.34"),
  ...extra,
});

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof CanvasFetchError ? e.code : "other"),
  );

describe("canvasFetch guards", () => {
  it("rejects http, undeclared and ungranted origins", async () => {
    expect(await code(canvasFetch("http://a.com/x", opts(["a.com"])))).toBe("not-allowed");
    expect(await code(canvasFetch("https://b.com/x", opts(["a.com"])))).toBe("not-allowed");
    expect(
      await code(
        canvasFetch("https://a.com/x", { allowedOrigins: ["https://a.com"], granted: [] }),
      ),
    ).toBe("needs-grant");
  });

  it("blocks localhost names and IP literals", async () => {
    for (const h of ["localhost", "x.localhost", "printer.local", "127.0.0.1", "[::1]", "10.1.2.3"])
      expect(await code(canvasFetch(`https://${h}/`, opts([h])))).toBe("blocked");
  });

  it("blocks hostnames that resolve to private addresses (real https lookup path)", async () => {
    for (const [ip, fam] of [
      ["10.0.0.5", 4],
      ["169.254.169.254", 4],
      ["::ffff:127.0.0.1", 6],
      ["::ffff:7f00:1", 6],
    ] as const)
      expect(
        await code(canvasFetch("https://a.com/", opts(["a.com"], { lookup: lookupTo(ip, fam) }))),
      ).toBe("blocked");
  });

  it("isBlockedIp covers the ranges and lets public IPs through", () => {
    for (const ip of [
      "0.1.2.3",
      "100.64.0.1",
      "172.16.5.5",
      "192.168.1.1",
      "224.0.0.1",
      "::",
      "fc00::1",
      "fe80::1",
      "::ffff:192.168.0.1",
    ])
      expect(isBlockedIp(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "172.32.0.1", "2606:4700::1", "::ffff:8.8.8.8"])
      expect(isBlockedIp(ip), ip).toBe(false);
  });
});

describe("canvasFetch hops", () => {
  const ok =
    (body = "hi", contentType = "text/plain"): CanvasHop =>
    async () => ({ status: 200, contentType, body });

  it("returns a text result", async () => {
    const r = await canvasFetch(
      "https://a.com/x",
      opts(["a.com"], { hop: ok('{"a":1}', "application/json") }),
    );
    expect(r).toEqual({ status: 200, contentType: "application/json", body: '{"a":1}' });
  });

  it("rejects non-text content types with bad-gateway", async () => {
    expect(
      await code(canvasFetch("https://a.com/", opts(["a.com"], { hop: ok("x", "image/png") }))),
    ).toBe("bad-gateway");
  });

  it("re-checks redirects: allowed follows, foreign origin → not-allowed, loop → bad-gateway", async () => {
    const redirect =
      (to: string): CanvasHop =>
      async (url) =>
        url.pathname === "/start"
          ? { status: 302, location: to, contentType: "", body: "" }
          : { status: 200, contentType: "text/html", body: "done" };
    expect(
      (await canvasFetch("https://a.com/start", opts(["a.com"], { hop: redirect("/end") }))).body,
    ).toBe("done");
    expect(
      await code(
        canvasFetch("https://a.com/start", opts(["a.com"], { hop: redirect("https://evil.com/") })),
      ),
    ).toBe("not-allowed");
    expect(
      await code(
        canvasFetch(
          "https://a.com/start",
          opts(["a.com"], {
            hop: async () => ({ status: 302, location: "/start", contentType: "", body: "" }),
          }),
        ),
      ),
    ).toBe("bad-gateway");
  });

  it("maps a lookup rejection from the hop to blocked and aborts on timeout", async () => {
    const blockedHop: CanvasHop = async () => {
      throw Object.assign(new Error("x"), { code: "EBLOCKED" });
    };
    expect(await code(canvasFetch("https://a.com/", opts(["a.com"], { hop: blockedHop })))).toBe(
      "blocked",
    );
    const hang: CanvasHop = (_u, { signal }) =>
      new Promise((_r, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
    expect(
      await code(canvasFetch("https://a.com/", opts(["a.com"], { hop: hang, timeoutMs: 20 }))),
    ).toBe("bad-gateway");
  });
});
