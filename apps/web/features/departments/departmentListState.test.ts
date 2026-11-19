import { describe, expect, it } from "vitest";
import { departmentPillTone } from "./departmentListState";

describe("departmentPillTone", () => {
  it("maps live states to tones and hides idle", () => {
    expect(departmentPillTone("running")).toBe("working");
    expect(departmentPillTone("waiting")).toBe("blocked");
    expect(departmentPillTone("error")).toBe("error");
    expect(departmentPillTone("idle")).toBeUndefined();
  });
});
