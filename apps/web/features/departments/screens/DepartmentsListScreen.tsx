"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  CardSkeleton,
  CodeTile,
  Container,
  EmptyState,
  Grid,
  ListHeader,
  OrgChart,
  Stack,
} from "@zibby/design-system";
import type { DepartmentWithStatus } from "@zibby/contracts";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useAgentsQuery } from "../../agents";
import { DepartmentCard } from "../components/DepartmentCard";
import { useDepartmentsQuery } from "../queries";

/**
 * `/workforce/departments` — department index (design Seznamy "Oddělení"): an org-chart
 * frame (static root pill, connector lines) over a 3-up grid of department cards.
 * Built only on the existing department + agent queries; there is no "lead" field.
 */
export function DepartmentsListScreen() {
  const t = useTranslations("departmentsList");
  const router = useRouter();
  const departmentsQuery = useDepartmentsQuery();
  const agentsQuery = useAgentsQuery();
  const departments = departmentsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  const openDepartment = (d: DepartmentWithStatus) =>
    router.push(`/workforce/departments/${d.id}/team` as Route);

  const working = departments.filter((d) => d.state === "running").length;
  const waiting = departments.filter((d) => d.state === "waiting").length;
  const failing = departments.filter((d) => d.state === "error").length;

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <ListHeader
          count={[
            { text: t("countDepartments", { count: departments.length }), tone: "plain" },
            ...(working > 0
              ? [{ text: t("countWorking", { count: working }), tone: "run" as const }]
              : []),
            ...(waiting > 0
              ? [{ text: t("countWaiting", { count: waiting }), tone: "warn" as const }]
              : []),
            ...(failing > 0
              ? [{ text: t("countFailing", { count: failing }), tone: "bad" as const }]
              : []),
          ]}
          route="/workforce/departments"
          section={t("section")}
          title={t("title")}
        />

        {departmentsQuery.isPending ? (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} shape="card" />
            ))}
          </Grid>
        ) : departmentsQuery.isError ? (
          <QueryError onRetry={() => void departmentsQuery.refetch()} />
        ) : departments.length === 0 ? (
          <EmptyState body={t("emptyDescription")} icon="building" title={t("emptyTitle")} />
        ) : (
          <OrgChart
            root={
              <>
                <CodeTile code={t("rootMonogram")} size="sm" />
                {t("rootLabel", { count: departments.length })}
              </>
            }
          >
            <Grid cols={1} gap="200" lg={3} sm={2}>
              {departments.map((d) => (
                <DepartmentCard
                  agentCount={agents.filter((a) => a.department === d.id).length}
                  department={d}
                  key={d.id}
                  onOpen={openDepartment}
                />
              ))}
            </Grid>
          </OrgChart>
        )}
      </Stack>
    </Container>
  );
}
