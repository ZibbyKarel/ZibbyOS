import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CANVAS_MAX_HTML_BYTES, CanvasStore, parseManifest } from "./canvas.store";

describe("CanvasStore", () => {
  let dir: string;
  let store: CanvasStore;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-store-"));
    store = new CanvasStore(dir);
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("publishes a new canvas then a next version of the same id", async () => {
    const v1 = await store.publish({ title: "T", html: "<p>1</p>", conversationId: "c1" });
    expect(v1.id).toMatch(/^[a-z0-9]{10}$/);
    expect(v1.current).toBe(1);
    const v2 = await store.publish({ title: "T2", html: "<p>2</p>", id: v1.id, note: "n" });
    expect(v2.current).toBe(2);
    expect(v2.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(v2.versions[1]?.note).toBe("n");
    expect(v2.conversationId).toBe("c1");
    expect(await store.readHtml(v1.id, 1)).toBe("<p>1</p>");
    expect(await store.readHtml(v1.id, 2)).toBe("<p>2</p>");
    expect(await store.get(v1.id)).toEqual(v2);
  });

  it("rejects empty, oversized and unknown-id publishes", async () => {
    await expect(store.publish({ title: "T", html: "  " })).rejects.toMatchObject({
      code: "empty",
    });
    await expect(
      store.publish({ title: "T", html: "x".repeat(CANVAS_MAX_HTML_BYTES + 1) }),
    ).rejects.toMatchObject({ code: "too-large" });
    await expect(
      store.publish({ title: "T", html: "<p/>", id: "abcdefghij" }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("returns null for malformed ids, versions and missing data", async () => {
    expect(await store.get("../etc")).toBeNull();
    expect(await store.get("abcdefghij")).toBeNull();
    expect(await store.readHtml("abcdefghij", 1)).toBeNull();
    expect(await store.readHtml("abcdefghij", 0)).toBeNull();
  });

  it("serialises concurrent publishes to one id", async () => {
    const m = await store.publish({ title: "T", html: "<p>1</p>" });
    await Promise.all([1, 2, 3].map(() => store.publish({ title: "T", html: "<p/>", id: m.id })));
    expect((await store.get(m.id))?.versions).toHaveLength(4);
  });

  describe("manifest, params, restore, grants", () => {
    const manifest = {
      params: [
        { id: "n", label: "N", type: "number", min: 0, max: 10, value: 5 },
        { id: "c", label: "C", type: "select", options: ["a", "b"], value: "a" },
        { id: "t", label: "T", type: "text", value: "x" },
        { id: "b", label: "B", type: "boolean", value: false },
      ],
      net: ["https://api.example.com/path"],
    };
    const page = `<p>hi</p><script type="application/zibby+json">${JSON.stringify(manifest)}</script>`;

    it("parseManifest: absent, valid (net normalised), invalid", () => {
      expect(parseManifest("<p/>")).toBeUndefined();
      expect(parseManifest(page)?.net).toEqual(["https://api.example.com"]);
      expect(() => parseManifest('<script type="application/zibby+json">{nope</script>')).toThrow(
        /not valid JSON/,
      );
      expect(() =>
        parseManifest('<script type="application/zibby+json">{"net":["http://x.com"]}</script>'),
      ).toThrow(expect.objectContaining({ code: "bad-manifest" }));
    });

    it("publish records manifest, kind and by", async () => {
      const m = await store.publish({ title: "T", html: page });
      expect(m.versions[0]).toMatchObject({ kind: "code", by: "agent" });
      expect(m.versions[0]?.manifest?.params).toHaveLength(4);
      await expect(
        store.publish({
          title: "T",
          html: '<script type="application/zibby+json">{"params":[{"id":"1x"}]}</script>',
        }),
      ).rejects.toMatchObject({ code: "bad-manifest" });
    });

    it("setParams validates, merges and coalesces operator edits", async () => {
      const m = await store.publish({ title: "T", html: page });
      const bad = (v: Record<string, string | number | boolean>) =>
        expect(store.setParams(m.id, v, { by: "operator" })).rejects.toMatchObject({
          code: "bad-params",
        });
      await bad({ zzz: 1 });
      await bad({ n: 11 });
      await bad({ n: "3" });
      await bad({ c: "z" });
      await bad({ b: "yes" });
      const a = await store.setParams(m.id, { n: 3 }, { by: "operator" });
      expect(a.current).toBe(2);
      expect(a.versions[1]).toMatchObject({ kind: "params", base: 1, by: "operator" });
      expect(a.versions[1]?.params).toEqual({ n: 3, c: "a", t: "x", b: false });
      const b = await store.setParams(m.id, { c: "b" }, { by: "operator", note: "n" });
      expect(b.versions).toHaveLength(2);
      expect(b.versions[1]?.params).toEqual({ n: 3, c: "b", t: "x", b: false });
      expect(b.versions[1]?.note).toBe("n");
      const c = await store.setParams(m.id, { n: 4 }, { by: "agent" });
      expect(c.versions).toHaveLength(3);
      const d = await store.setParams(m.id, { n: 5 }, { by: "operator" });
      expect(d.versions).toHaveLength(4);
      const e = await store.effective(m.id, d.current);
      expect(e).toMatchObject({ codeVersion: 1, params: { n: 5, c: "b" } });
      expect(e?.html).toBe(page);
    });

    it("setParams without a manifest → bad-params", async () => {
      const m = await store.publish({ title: "T", html: "<p/>" });
      await expect(store.setParams(m.id, { a: 1 }, { by: "agent" })).rejects.toMatchObject({
        code: "bad-params",
      });
    });

    it("restore appends a copy (code and params) as current", async () => {
      const m = await store.publish({ title: "T", html: page });
      await store.setParams(m.id, { n: 7 }, { by: "operator" });
      await store.publish({ title: "T", html: "<p>new</p>", id: m.id });
      const r1 = await store.restore(m.id, 1);
      expect(r1.current).toBe(4);
      expect(r1.versions[3]).toMatchObject({ kind: "code", by: "operator" });
      expect(await store.readHtml(m.id, 4)).toBe(page);
      const r2 = await store.restore(m.id, 2);
      expect(r2.versions[4]).toMatchObject({ kind: "params", base: 1, params: { n: 7 } });
      expect((await store.effective(m.id, 5))?.params.n).toBe(7);
      await expect(store.restore(m.id, 99)).rejects.toMatchObject({ code: "not-found" });
    });

    it("grants: only manifest origins of the current code version, deduped", async () => {
      const m = await store.publish({ title: "T", html: page });
      expect(await store.grants(m.id)).toEqual([]);
      await expect(store.grant(m.id, "https://evil.com")).rejects.toMatchObject({
        code: "not-allowed",
      });
      expect(await store.grant(m.id, "https://api.example.com")).toEqual([
        "https://api.example.com",
      ]);
      expect(await store.grant(m.id, "https://api.example.com")).toHaveLength(1);
      await store.publish({ title: "T", html: "<p/>", id: m.id });
      await expect(store.grant(m.id, "https://api.example.com")).rejects.toMatchObject({
        code: "not-allowed",
      });
    });
  });
});
