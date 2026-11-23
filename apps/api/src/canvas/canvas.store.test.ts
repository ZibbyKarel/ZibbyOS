import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CANVAS_MAX_HTML_BYTES, CanvasStore } from "./canvas.store";

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
});
