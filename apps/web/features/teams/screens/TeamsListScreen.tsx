"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  ListHeader,
  ListToolbar,
  Stack,
  Typography,
} from "@zibby/design-system";
import type { Team } from "@zibby/contracts";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useCompaniesQuery } from "../../companies/queries";
import { TeamCard } from "../components/TeamCard";
import { useTeamsQuery } from "../queries";
import { ALL_TEAMS, NO_COMPANY, filterTeams } from "../teamFilter";

/**
 * `/teams` — the team catalog (design Seznamy "Týmy"): shared list header with a live count
 * line, search + per-company filter chips, 3-up cards, skeletons and an empty state.
 */
export function TeamsListScreen() {
  const t = useTranslations("teams");
  const router = useRouter();
  const teamsQuery = useTeamsQuery();
  const { data: companies = [] } = useCompaniesQuery();
  const teams = teamsQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState(ALL_TEAMS);

  const openTeam = (team: Team) => router.push(`/teams/${team.id}` as Route);
  const addTeam = () => router.push("/teams/new" as Route);

  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const usedCompanies = companies.filter((c) => teams.some((tm) => tm.companyId === c.id));
  const orphanCount = teams.filter((tm) => !tm.companyId || !companyName.has(tm.companyId)).length;
  const visible = filterTeams(teams, chip, search);
  const filtered = search.trim() !== "" || chip !== ALL_TEAMS;

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <ListHeader
          actions={
            <Button icon="plus" intent="ink" onClick={addTeam}>
              {t("newTeam")}
            </Button>
          }
          count={[
            { text: t("countTeams", { count: teams.length }), tone: "plain" },
            { text: t("inCompanies", { count: usedCompanies.length }), tone: "plain" },
          ]}
          route="/teams"
          section={t("section")}
          title={t("title")}
        />

        {teams.length > 0 && (
          <ListToolbar
            activeChip={chip}
            chips={[
              { id: ALL_TEAMS, label: t("filterAll"), count: teams.length },
              ...usedCompanies.map((c) => ({
                id: c.id,
                label: c.name,
                count: teams.filter((tm) => tm.companyId === c.id).length,
              })),
              ...(orphanCount > 0 && usedCompanies.length > 0
                ? [{ id: NO_COMPANY, label: t("filterNoCompany"), count: orphanCount }]
                : []),
            ]}
            onChipChange={setChip}
            search={{ value: search, onChange: setSearch, placeholder: t("searchPlaceholder") }}
          />
        )}

        {teamsQuery.isPending ? (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} shape="card" />
            ))}
          </Grid>
        ) : teamsQuery.isError ? (
          <QueryError onRetry={() => void teamsQuery.refetch()} />
        ) : teams.length === 0 ? (
          <EmptyState
            action={
              <Button icon="plus" intent="ink" onClick={addTeam}>
                {t("addTeam")}
              </Button>
            }
            body={t("emptyDescription")}
            icon="users"
            title={t("emptyTitle")}
          />
        ) : visible.length === 0 && filtered ? (
          <Typography size="sm" type="note" variant="tertiary">
            {t("noMatch")}
          </Typography>
        ) : (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {visible.map((team) => (
              <TeamCard
                companyName={team.companyId ? companyName.get(team.companyId) : undefined}
                key={team.id}
                onOpen={openTeam}
                team={team}
              />
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
