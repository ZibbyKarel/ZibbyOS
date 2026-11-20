import { type Company, NO_AUTOMATION, type Team } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import {
  EMPTY_AUTOMATION,
  PILL_ORB,
  buildScopes,
  effectiveByNode,
  exceptionsOf,
  inColumn,
  inheritAll,
  manualKeys,
  setLevel,
  toggledLevel,
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

  it("the two columns add up: Automat implies Poloautomat", () => {
    expect(["manual", "semi", "auto"].map((l) => inColumn(l as never, "semi"))).toEqual([
      false,
      true,
      true,
    ]);
    expect(["manual", "semi", "auto"].map((l) => inColumn(l as never, "auto"))).toEqual([
      false,
      false,
      true,
    ]);
    // Poloautomat off takes Automat with it, Automat on brings Poloautomat along
    expect(toggledLevel("auto", "semi")).toBe("manual");
    expect(toggledLevel("semi", "semi")).toBe("manual");
    expect(toggledLevel("manual", "semi")).toBe("semi");
    expect(toggledLevel("manual", "auto")).toBe("auto");
    expect(toggledLevel("auto", "auto")).toBe("semi");
  });

  it("setLevel writes the global row as the base", () => {
    const next = setLevel(EMPTY_AUTOMATION, global, NO_AUTOMATION, "autoReview", "semi");
    expect(next.global.autoReview).toBe("semi");
    expect(effectiveByNode(next, scopes)["team:web"]?.autoReview).toBe("semi");
    expect(effectiveByNode(next, scopes)["team:lone"]?.autoReview).toBe("semi");
  });

  it("setLevel writes an override and a level equal to the parent removes it", () => {
    const on = setLevel(EMPTY_AUTOMATION, acme, NO_AUTOMATION, "autoReview", "auto");
    expect(on.companies).toEqual({ acme: { autoReview: "auto" } });
    const eff = effectiveByNode(on, scopes);
    expect(eff["team:web"]?.autoReview).toBe("auto");
    expect(eff["team:lone"]?.autoReview).toBe("manual");
    const down = setLevel(on, web, eff["company:acme"] ?? NO_AUTOMATION, "autoReview", "semi");
    expect(down.teams).toEqual({ web: { autoReview: "semi" } });
    const back = setLevel(down, web, eff["company:acme"] ?? NO_AUTOMATION, "autoReview", "auto");
    expect(back.teams).toEqual({});
  });

  it("inheritAll drops a row's overrides but never touches global", () => {
    const a = { ...EMPTY_AUTOMATION, companies: { acme: { autoReview: "auto" as const } } };
    expect(inheritAll(a, acme).companies).toEqual({});
    expect(inheritAll(a, global)).toBe(a);
  });

  it("exceptionsOf lists the companies/teams that override something", () => {
    const a = { ...EMPTY_AUTOMATION, teams: { web: { autoReview: "semi" as const } } };
    expect(exceptionsOf(a, scopes)).toEqual([web]);
  });

  it("manualKeys lists what resolves to manual", () => {
    expect(manualKeys({ ...NO_AUTOMATION, autoReview: "semi", autoFixCi: "auto" })).toEqual([
      "autoAddressComments",
      "autoImplement",
      "autoCommunicate",
    ]);
  });
});

describe("PILL_ORB", () => {
  it("only a pause sleeps; manual listens (the butler is still available)", () => {
    expect(PILL_ORB.paused).toBe("sleep");
    expect(PILL_ORB.manual).toBe("listen");
  });
});
