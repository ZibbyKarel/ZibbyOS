import { describe, expect, it } from "vitest";
import type { Team } from "@zibby/contracts";
import { ALL_TEAMS, NO_COMPANY, filterTeams } from "./teamFilter";

const teams = [
  { id: "a", name: "Platforma", companyId: "zc", desc: "Jádro" },
  { id: "b", name: "Růst", companyId: "zc" },
  { id: "c", name: "Obsah", companyId: "nl", slug: "nl-obsah" },
  { id: "d", name: "Sirotek" },
] as Team[];

describe("filterTeams", () => {
  it("filters by company chip", () => {
    expect(filterTeams(teams, "zc", "").map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterTeams(teams, NO_COMPANY, "").map((t) => t.id)).toEqual(["d"]);
    expect(filterTeams(teams, ALL_TEAMS, "")).toHaveLength(4);
  });
  it("searches name, slug and description", () => {
    expect(filterTeams(teams, ALL_TEAMS, "nl-obs").map((t) => t.id)).toEqual(["c"]);
    expect(filterTeams(teams, "zc", "jádro").map((t) => t.id)).toEqual(["a"]);
  });
});
