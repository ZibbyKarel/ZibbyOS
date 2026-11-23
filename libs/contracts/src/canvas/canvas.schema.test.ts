import { describe, expect, it } from "vitest";
import {
  CanvasManifestSchema,
  CanvasMetaSchema,
  CanvasParamSchema,
  CanvasVersionSchema,
} from "./canvas.schema";

describe("canvas phase 2 schema", () => {
  it("parses an old meta.json (no kind) to kind code", () => {
    const meta = CanvasMetaSchema.parse({
      id: "a1b2c3d4e5",
      title: "Old",
      versions: [{ version: 1, at: "2026-11-23T10:00:00.000Z" }],
      current: 1,
    });
    expect(meta.versions[0]?.kind).toBe("code");
  });

  it("accepts a params version", () => {
    const v = CanvasVersionSchema.parse({
      version: 2,
      at: "2026-11-23T10:00:00.000Z",
      kind: "params",
      base: 1,
      params: { speed: 3, on: true, name: "x" },
      by: "operator",
    });
    expect(v.by).toBe("operator");
  });

  it("transforms net to origins and rejects http", () => {
    const m = CanvasManifestSchema.parse({ net: ["https://api.example.com/v1/x?q=1"] });
    expect(m.net).toEqual(["https://api.example.com"]);
    expect(m.params).toEqual([]);
    expect(CanvasManifestSchema.safeParse({ net: ["http://example.com"] }).success).toBe(false);
  });

  it("validates the param id regex", () => {
    const base = { label: "L", type: "number" as const, value: 1 };
    for (const id of ["speed", "a-b_c9", "A"]) {
      expect(CanvasParamSchema.safeParse({ ...base, id }).success).toBe(true);
    }
    for (const id of ["1a", "-a", "a b", "", "a".repeat(41)]) {
      expect(CanvasParamSchema.safeParse({ ...base, id }).success).toBe(false);
    }
  });
});
