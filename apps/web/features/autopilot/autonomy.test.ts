import { type Company, NO_AUTOMATION, type Team } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import {
  EMPTY_AUTOMATION,
  buildScopes,
  effectiveByNode,
  exceptionsOf,
  inheritAll,
  inheritCap,
  moveCap,
} from "./autonomy";

const companies = [{ id: "acme", name: "Acme" }] as Company[];
const teams = [
  { id: "web", name: "Web", companyId: "acme" },
  { id: "lone", name: "Lone" },
] as Team[];
const scopes = buildScopes(companies, teams);
const [global, acme, web, lone] = scopes;
if (!global || !acme || !web || !lone) throw new Error("scopes");

describe("autonomy tree helpers", () => {
  it("nests teams under their company and orphans under global", () => {
    expect(scopes.map((s) => [s.node, s.parent])).toEqual([
      ["global", null],
      ["company:acme", "global"],
      ["team:web", "company:acme"],
      ["team:lone", "global"],
    ]);
  });

  it("moveCap writes an override and a value equal to the parent removes it", () => {
    const on = moveCap(EMPTY_AUTOMATION, acme, NO_AUTOMATION, "autoReview", "auto");
    expect(on.companies).toEqual({ acme: { autoReview: true } });
    const eff = effectiveByNode(on, scopes);
    expect(eff["team:web"]?.autoReview).toBe(true);
    expect(eff["team:lone"]?.autoReview).toBe(false);
    // team goes back to manual = differs from company -> override; auto again = same as company -> none
    const semi = moveCap(on, web, eff["company:acme"] ?? NO_AUTOMATION, "autoReview", "manual");
    expect(semi.teams).toEqual({ web: { autoReview: false } });
    const back = moveCap(semi, web, eff["company:acme"] ?? NO_AUTOMATION, "autoReview", "auto");
    expect(back.teams).toEqual({});
  });

  it("never produces semi or edits global, and keeps global all-off", () => {
    expect(moveCap(EMPTY_AUTOMATION, acme, NO_AUTOMATION, "autoReview", "semi")).toBe(
      EMPTY_AUTOMATION,
    );
    expect(moveCap(EMPTY_AUTOMATION, global, NO_AUTOMATION, "autoReview", "auto")).toBe(
      EMPTY_AUTOMATION,
    );
    const dirty = { ...EMPTY_AUTOMATION, global: { ...NO_AUTOMATION, autoReview: true } };
    expect(moveCap(dirty, acme, NO_AUTOMATION, "autoFixCi", "auto").global).toEqual(NO_AUTOMATION);
  });

  it("inheritCap / inheritAll drop overrides", () => {
    const a = { ...EMPTY_AUTOMATION, companies: { acme: { autoReview: true, autoFixCi: true } } };
    expect(inheritCap(a, acme, "autoReview").companies).toEqual({ acme: { autoFixCi: true } });
    expect(inheritAll(a, acme).companies).toEqual({});
  });

  it("exceptionsOf lists overrides with lanes", () => {
    const a = { ...EMPTY_AUTOMATION, teams: { web: { autoReview: false } } };
    expect(exceptionsOf(a, scopes)).toEqual([
      { scope: web, entries: [{ key: "autoReview", lane: "manual" }] },
    ]);
  });
});
