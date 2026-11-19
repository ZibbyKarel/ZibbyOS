import type { Team } from "@zibby/contracts";

/** Filter chip id for teams that belong to no company. */
export const NO_COMPANY = "__none";
export const ALL_TEAMS = "all";

/** Teams matching the company chip (`all` / a company id / {@link NO_COMPANY}) and the search text (name, slug, id, description). */
export function filterTeams(teams: readonly Team[], chip: string, search: string): Team[] {
  const q = search.trim().toLowerCase();
  return teams.filter((t) => {
    if (chip === NO_COMPANY ? t.companyId : chip !== ALL_TEAMS && t.companyId !== chip) {
      return false;
    }
    if (!q) return true;
    return [t.name, t.slug, t.id, t.desc].some((v) => v?.toLowerCase().includes(q));
  });
}
