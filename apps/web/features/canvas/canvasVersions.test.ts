import type { CanvasVersion } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { canvasVersionLabels, codeVersionOf } from "./canvasVersions";

const at = "2026-01-01T00:00:00.000Z";
const code = (version: number): CanvasVersion => ({ version, at, kind: "code" });
const params = (version: number, base: number): CanvasVersion => ({
  version,
  at,
  kind: "params",
  base,
  params: {},
});
const versions = [code(1), params(2, 1), params(3, 1), code(4), params(5, 4), params(6, 1)];

describe("canvasVersionLabels", () => {
  it("numbers code versions and counts params versions per base", () => {
    const labels = canvasVersionLabels(versions);
    expect([...labels.values()]).toEqual(["v1", "v1.1", "v1.2", "v2", "v2.1", "v1.3"]);
  });
});

describe("codeVersionOf", () => {
  it("resolves params versions to their base", () => {
    expect(codeVersionOf(versions, 3)).toBe(1);
    expect(codeVersionOf(versions, 4)).toBe(4);
    expect(codeVersionOf(versions, 99)).toBeUndefined();
  });
});
