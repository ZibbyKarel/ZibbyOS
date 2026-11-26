import { type Company, NO_AUTOMATION, type Project, type Team } from "@zibby/contracts";
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
  pillTone,
  setLevel,
  toggledLevel,
} from "./autonomy";

const companies = [{ id: "acme", name: "Acme" }] as Company[];
const teams = [
  { id: "web", name: "Web", companyId: "acme" },
  { id: "lone", name: "Lone" },
] as Team[];
const projects = [
  { id: "shop", name: "Shop", companyId: "acme" },
  { id: "free", name: "Free" },
  { id: "ghost", name: "Ghost", companyId: "gone" },
] as Project[];
const scopes = buildScopes(companies, teams, projects);
const [global, acme, web, shop, lone, free] = scopes;
if (!global || !acme || !web || !shop || !lone || !free) throw new Error("scopes");

describe("autonomy tree helpers", () => {
  it("nests teams under their company and orphans under global", () => {
    expect(scopes.map((s) => [s.node, s.parent])).toEqual([
      ["global", null],
      ["company:acme", "global"],
      ["team:web", "company:acme"],
      ["project:shop", "company:acme"],
      ["team:lone", "global"],
      ["project:free", "global"],
      ["project:ghost", "global"],
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

  it("a project writes projects.<id>, inherits its company (not a team), and inheritAll clears it", () => {
    const base = setLevel(EMPTY_AUTOMATION, acme, NO_AUTOMATION, "autoReview", "auto");
    const eff = effectiveByNode(base, scopes);
    expect(eff["project:shop"]?.autoReview).toBe("auto");
    const on = setLevel(base, shop, eff["company:acme"] ?? NO_AUTOMATION, "autoFixCi", "semi");
    expect(on.projects).toEqual({ shop: { autoFixCi: "semi" } });
    expect(on.teams).toEqual({});
    expect(inheritAll(on, shop).projects).toEqual({});
  });

  it("exceptionsOf lists a project that overrides something", () => {
    const a = { ...EMPTY_AUTOMATION, projects: { shop: { autoReview: "semi" as const } } };
    expect(exceptionsOf(a, scopes)).toEqual([shop]);
  });

  it("manualKeys lists what resolves to manual", () => {
    expect(manualKeys({ ...NO_AUTOMATION, autoReview: "semi", autoFixCi: "auto" })).toEqual([
      "autoAddressComments",
      "autoImplement",
      "autoCommunicate",
      "autoDecideGoals",
    ]);
  });
});

describe("PILL_ORB", () => {
  it("pause and manual sleep (greyed pill); semi and auto stay lit", () => {
    expect(PILL_ORB.paused).toBe("sleep");
    expect(PILL_ORB.manual).toBe("sleep");
    expect(pillTone("manual")).toBe("paused");
    expect(pillTone("semi")).toBe("run");
  });
});
