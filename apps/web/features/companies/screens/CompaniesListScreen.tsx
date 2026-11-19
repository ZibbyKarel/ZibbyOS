"use client";

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
  Stack,
} from "@zibby/design-system";
import type { Company } from "@zibby/contracts";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useBudgetQuery, useProjectsQuery } from "../../projects/queries";
import { useTeamsQuery } from "../../teams/queries";
import { CompanyCard } from "../components/CompanyCard";
import { summarizeCompany } from "../companySummary";
import { useCompaniesQuery } from "../queries";

/**
 * `/companies` — the company catalog (design Seznamy "Firmy"): shared list header with a
 * live count line, a 2-up grid of large company cards (people, team -> project tree,
 * budget gauge), card-shaped skeletons and an empty state with an icon.
 */
export function CompaniesListScreen() {
  const t = useTranslations("companies");
  const router = useRouter();
  const companiesQuery = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const { data: projects = [] } = useProjectsQuery();
  const { data: budget } = useBudgetQuery();
  const companies = companiesQuery.data ?? [];

  const openCompany = (c: Company) => router.push(`/companies/${c.id}` as Route);
  const addCompany = () => router.push("/companies/new" as Route);

  const peopleTotal = companies.reduce((n, c) => n + (c.people?.length ?? 0), 0);
  const linkedProjects = projects.filter((p) => p.companyId).length;

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <ListHeader
          actions={
            <Button icon="plus" intent="ink" onClick={addCompany}>
              {t("newCompany")}
            </Button>
          }
          count={[
            { text: t("countCompanies", { count: companies.length }), tone: "plain" },
            ...(peopleTotal > 0
              ? [{ text: t("peopleCount", { count: peopleTotal }), tone: "plain" as const }]
              : []),
            { text: t("projectsCount", { count: linkedProjects }), tone: "plain" },
          ]}
          route="/companies"
          section={t("section")}
          title={t("title")}
        />

        {companiesQuery.isPending ? (
          <Grid cols={1} gap="200" lg={2}>
            <CardSkeleton shape="wide" />
            <CardSkeleton shape="wide" />
          </Grid>
        ) : companiesQuery.isError ? (
          <QueryError onRetry={() => void companiesQuery.refetch()} />
        ) : companies.length === 0 ? (
          <EmptyState
            action={
              <Button icon="plus" intent="ink" onClick={addCompany}>
                {t("addCompany")}
              </Button>
            }
            body={t("emptyDescription")}
            icon="building"
            title={t("emptyTitle")}
          />
        ) : (
          <Grid cols={1} gap="200" lg={2}>
            {companies.map((c) => (
              <CompanyCard
                company={c}
                key={c.id}
                onOpen={openCompany}
                summary={summarizeCompany(c, teams, projects, budget)}
              />
            ))}
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
