"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { ProjectPerson } from "@zibby/contracts";
import {
  BudgetGauge,
  Button,
  Chip,
  ConfirmDeleteButton,
  ContactRow,
  Container,
  EntityHeader,
  EntityLogo,
  Grid,
  Panel,
  Row,
  Stack,
  type SubNavLinkComponent,
  Tab,
  TabList,
  Tabs,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { PageBreadcrumb } from "../../../components/layout/PageBreadcrumb";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import { slug } from "../../../utils/slug";
import { runsListHref } from "../../archive/runsListFilters";
import { useRunsQuery } from "../../runs";
import { useTeamsQuery } from "../../teams/queries";
import { useIntegrationsQuery } from "../../integrations";
import { ConnectWizardSheet } from "../../integrations/components/ConnectWizardSheet";
import { EntityConnections } from "../../integrations/components/EntityConnections";
import { buildConnections } from "../../integrations/connectionsModel";
import { accountHref } from "../../integrations/accountHref";
import { useEntityT } from "../../entity/useEntityT";
import { projectRunStats } from "../../projects/projectRunStats";
import { useBudgetQuery, useProjectsQuery } from "../../projects";
import { CompanyAboutPanel } from "../components/CompanyAboutPanel";
import { CompanyCapsPanel, formatUsd } from "../components/CompanyCapsPanel";
import { CompanyProjectsPanel } from "../components/CompanyProjectsPanel";
import { companyUsage, pctOf } from "../companyUsage";
import { type CompanyBasicsBody, CompanyBasicsPanel } from "../components/CompanyBasicsPanel";
import { CompanyIntegrationsPanel } from "../components/CompanyIntegrationsPanel";
import { LinkProjectDialog } from "../components/LinkProjectDialog";
import {
  useCreateCompanyMutation,
  useDeleteCompanyMutation,
  useUpdateCompanyMutation,
} from "../mutations";
import { useCompanyQuery } from "../queries";

const COMPANY_TABS = ["overview", "integrations"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

export interface CompanyDetailScreenProps {
  /** The company to edit; omitted when creating a new one (the `/companies/new` route). */
  companyId?: string;
}

/**
 * `/companies/[id]` (ZB-06) — moved from `/companies/[id]` and re-skinned:
 * a `MetricStrip` (projects/contacts/budget), the linked-projects `DataTable`,
 * contacts as `ContactRow`s, `ConfirmDeleteButton` for delete, and the
 * "ALL TASKS FOR THIS COMPANY →" link into `/activity/runs?company=<id>`.
 */
export function CompanyDetailScreen({ companyId }: CompanyDetailScreenProps) {
  const t = useTranslations("companies");
  const te = useEntityT();
  const router = useRouter();

  const isNew = !companyId;
  const id = companyId ?? "";

  const companyQ = useCompanyQuery(id, { enabled: !isNew });
  const projectsQ = useProjectsQuery();
  const teamsQ = useTeamsQuery();
  const integrationsQ = useIntegrationsQuery();
  const budgetQ = useBudgetQuery();
  const { runs } = useRunsQuery();
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const createCompany = useCreateCompanyMutation();
  const updateCompany = useUpdateCompanyMutation();
  const deleteCompany = useDeleteCompanyMutation();

  const [people, setPeople] = useState<ProjectPerson[] | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [linkingProject, setLinkingProject] = useState(false);
  // `?tab=integrations` deep-links the tab (the integration detail page's back link).
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CompanyTab>(
    searchParams.get("tab") === "integrations" ? "integrations" : "overview",
  );

  if (!isNew && companyQ.isError) return <QueryError onRetry={() => void companyQ.refetch()} />;
  if (!isNew && companyQ.isPending) return <QueryLoading />;

  const company = isNew ? undefined : companyQ.data;
  const effectivePeople: ProjectPerson[] = people ?? company?.people ?? [];

  function saveBasics(body: CompanyBasicsBody) {
    if (isNew) {
      const newId = slug(body.name) || `company-${Date.now()}`;
      createCompany.mutate(
        { body: { ...body, id: newId } },
        { onSuccess: () => router.replace(`/companies/${newId}` as Route) },
      );
    } else {
      updateCompany.mutate({ params: { id }, body });
    }
  }

  function persistPeople(next: ProjectPerson[]) {
    updateCompany.mutate(
      { params: { id }, body: { people: next } },
      { onSuccess: () => setPeople(null) },
    );
  }

  function addContact() {
    if (!newContactName.trim() || !newContactRole.trim()) return;
    persistPeople([
      ...effectivePeople,
      { name: newContactName.trim(), role: newContactRole.trim() },
    ]);
    setNewContactName("");
    setNewContactRole("");
  }

  const memberProjects = (projectsQ.data ?? []).filter((p) => p.companyId === id);
  const allIntegrations = integrationsQ.data ?? [];
  const companyTeams = (teamsQ.data ?? []).filter((tm) => tm.companyId === id);
  const teamNames = Object.fromEntries((teamsQ.data ?? []).map((tm) => [tm.id, tm.name]));
  const runs30d = Object.fromEntries(
    memberProjects.map((p) => [p.id, projectRunStats(runs, p.id, now).runs30d]),
  );
  const model = buildConnections(
    allIntegrations.filter((i) => i.companyId === id),
    "own",
    now,
    memberProjects.length,
  );
  const usage = companyUsage(
    company?.budget,
    budgetQ.data,
    new Set(memberProjects.map((p) => p.id)),
  );
  const monthRow = usage.rows[2];
  const gaugePct = usage.monthlyPct ?? pctOf(monthRow?.runsUsed ?? 0, monthRow?.runsCap) ?? 0;
  const initials = (company?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const month = new Date(now).toLocaleString(undefined, { month: "long" });

  const summary = company ? (
    <Typography size="sm" type="note" variant="secondary">
      {te("connections.summary", { connected: model.connected })}
      {model.attention.length > 0 && (
        <>
          {", "}
          <Typography as="span" size="sm" tone="warn" type="note">
            {te("company.summary.attention", { count: model.attention.length })}
          </Typography>
        </>
      )}
      {" · "}
      {te("company.summary.counts", {
        teams: companyTeams.length,
        projects: memberProjects.length,
        contacts: effectivePeople.length,
      })}
    </Typography>
  ) : undefined;

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <PageBreadcrumb
          items={[
            { label: t("title"), href: "/companies" },
            { label: isNew ? t("newCompany") : (company?.name ?? "") },
          ]}
          linkComponent={Link as SubNavLinkComponent}
        />

        {isNew && <Typography type="h1">{t("newCompany")}</Typography>}

        {!isNew && company && (
          <EntityHeader
            actions={
              <Row gap="100">
                <Button
                  data-testid="entity-edit"
                  icon="edit"
                  intent="ghost"
                  onClick={() => setEditing((v) => !v)}
                  size="sm"
                >
                  {te("company.edit")}
                </Button>
                <ConfirmDeleteButton
                  confirmLabel={t("deleteTitle")}
                  label={t("delete")}
                  onConfirm={() =>
                    deleteCompany.mutate(
                      { params: { id } },
                      { onSuccess: () => router.push("/companies" as Route) },
                    )
                  }
                />
              </Row>
            }
            aside={
              <BudgetGauge
                caption={te("company.gauge.caption", { month })}
                of={monthRow?.spendCap ? `/ ${formatUsd(monthRow.spendCap)}` : undefined}
                pct={gaugePct}
                rows={
                  monthRow
                    ? [
                        {
                          label: te("company.gauge.runs"),
                          pct: pctOf(monthRow.runsUsed, monthRow.runsCap),
                          value: monthRow.runsCap
                            ? `${monthRow.runsUsed} / ${monthRow.runsCap}`
                            : String(monthRow.runsUsed),
                        },
                      ]
                    : []
                }
                value={formatUsd(usage.monthlySpend)}
              />
            }
            eyebrow={
              <>
                <Chip>{te("company.kind")}</Chip>
                <Typography mono size="xs" type="note" variant="tertiary">
                  {id}
                </Typography>
              </>
            }
            lede={company.desc}
            mark={<EntityLogo initials={initials} />}
            summary={summary}
            title={company.name}
            variant="company"
          />
        )}

        {!isNew && company && (
          <Tabs onValueChange={(v) => setTab(v as CompanyTab)} value={tab}>
            <TabList>
              {COMPANY_TABS.map((key) => (
                <Tab key={key} value={key}>
                  {t(`tabs.${key}`)}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        )}

        {!isNew && company && tab === "integrations" && (
          <Stack gap="250">
            <CompanyIntegrationsPanel
              companyId={id}
              ownerName={company.name}
              projectCount={memberProjects.length}
            />
          </Stack>
        )}

        {(isNew || (tab === "overview" && editing)) && (
          <CompanyBasicsPanel
            company={company}
            isNew={isNew}
            key={company?.id ?? "new"}
            onSave={saveBasics}
            saving={createCompany.isPending || updateCompany.isPending}
          />
        )}

        {!isNew && company && tab === "overview" && (
          <>
            <EntityConnections
              model={model}
              onConnect={() => setConnecting(true)}
              onOpen={(i) => router.push(accountHref(i))}
              ribbon={[
                { kind: "company", label: company.name, icon: "building", current: true },
                {
                  kind: "team",
                  label: te("company.ribbon.teams", { count: companyTeams.length }),
                  icon: "users",
                },
                {
                  kind: "project",
                  label: te("company.ribbon.projects", { count: memberProjects.length }),
                  icon: "grid",
                },
              ]}
            />

            <Grid gap="250" sidebar="right">
              <Stack gap="250">
                <CompanyProjectsPanel
                  companyId={id}
                  integrations={allIntegrations}
                  onAddExisting={() => setLinkingProject(true)}
                  onOpen={(pid) => router.push(`/projects/${pid}` as Route)}
                  projects={memberProjects}
                  runs30d={runs30d}
                  t={te}
                  teamNames={teamNames}
                />

                <Panel
                  headerRule
                  header={
                    <Row gap="100">
                      <Typography type="h3">{t("contactsTitle")}</Typography>
                      <Chip>{effectivePeople.length}</Chip>
                    </Row>
                  }
                  headerEnd={
                    <Typography size="xs" type="note" variant="tertiary">
                      {te("company.vipNote")}
                    </Typography>
                  }
                >
                  <Stack gap="0">
                    {effectivePeople.map((person, i) => (
                      <ContactRow
                        key={i}
                        name={person.name}
                        onRemove={() => persistPeople(effectivePeople.filter((_, j) => j !== i))}
                        onToggleVip={() =>
                          persistPeople(
                            effectivePeople.map((p, j) => (j === i ? { ...p, vip: !p.vip } : p)),
                          )
                        }
                        sub={person.role}
                        vip={person.vip ?? false}
                        vipLabel="VIP"
                      />
                    ))}
                    <Row gap="100">
                      <TextInputField
                        label={t("team.name")}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder={t("team.namePlaceholder")}
                        size="sm"
                        value={newContactName}
                      />
                      <TextInputField
                        label={t("team.role")}
                        onChange={(e) => setNewContactRole(e.target.value)}
                        placeholder={t("team.rolePlaceholder")}
                        size="sm"
                        value={newContactRole}
                      />
                      <Button icon="plus" intent="secondary" onClick={addContact} size="sm">
                        {t("team.add")}
                      </Button>
                    </Row>
                  </Stack>
                </Panel>
              </Stack>

              <Stack gap="250">
                <CompanyCapsPanel onEdit={() => setEditing(true)} t={te} usage={usage} />
                <CompanyAboutPanel
                  onOpenTasks={() => router.push(runsListHref({ company: id }) as Route)}
                  slug={id}
                  t={te}
                  tasksLabel={t("allTasksLink")}
                  teams={companyTeams}
                />
              </Stack>
            </Grid>
          </>
        )}
      </Stack>

      {linkingProject && (
        <LinkProjectDialog companyId={id} onClose={() => setLinkingProject(false)} />
      )}
      {connecting && company && (
        <ConnectWizardSheet
          inheritingCount={memberProjects.length}
          onClose={() => setConnecting(false)}
          onOpenIntegration={(iid) => router.push(accountHref({ id: iid, companyId: id }))}
          owner={{ companyId: id }}
          ownerName={company.name}
        />
      )}
    </Container>
  );
}
