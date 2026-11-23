import { describe, expect, it } from "vitest";
import { canvasContract } from "./canvas.contract";
import { CANVAS_ID_PATTERN, CanvasMetaSchema } from "./canvas.schema";

const VALID = {
  id: "a1b2c3d4e5",
  title: "Orbit demo",
  versions: [
    { version: 1, at: "2026-11-23T10:00:00.000Z" },
    { version: 2, at: "2026-11-23T10:05:00.000Z", note: "bigger sun" },
  ],
  current: 2,
};

describe("canvas.schema", () => {
  it("round-trips meta with and without conversationId", () => {
    const parsed = CanvasMetaSchema.parse(VALID);
    expect(parsed).toMatchObject(VALID);
    const withConv = { ...VALID, conversationId: "conv_1" };
    expect(CanvasMetaSchema.parse(withConv)).toMatchObject(withConv);
  });

  it("rejects a bad id, version 0 and a non-datetime", () => {
    expect(CANVAS_ID_PATTERN.test("a1b2c3d4e5")).toBe(true);
    for (const id of ["short", "UPPERCASE1", "a1b2c3d4e5f", "../etc/pw"]) {
      expect(CanvasMetaSchema.safeParse({ ...VALID, id }).success).toBe(false);
    }
    expect(
      CanvasMetaSchema.safeParse({
        ...VALID,
        versions: [{ version: 0, at: VALID.versions[0]!.at }],
      }).success,
    ).toBe(false);
    expect(
      CanvasMetaSchema.safeParse({ ...VALID, versions: [{ version: 1, at: "yesterday" }] }).success,
    ).toBe(false);
  });
});

describe("canvasContract", () => {
  it("exposes getCanvas as GET /api/canvas/:id plus the phase 2 routes", () => {
    expect(canvasContract.getCanvas.method).toBe("GET");
    expect(canvasContract.getCanvas.path).toBe("/api/canvas/:id");
    expect(Object.keys(canvasContract)).toEqual([
      "getCanvas",
      "setCanvasParams",
      "restoreCanvasVersion",
      "grantCanvasOrigin",
      "canvasFetch",
    ]);
  });
});
