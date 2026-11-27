"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { KnowledgeBaseSource } from "@zibby/contracts";
import {
  Button,
  Chip,
  ConfirmDeleteButton,
  Container,
  EntityHeader,
  IconTile,
  Panel,
  Row,
  Stack,
  type SubNavLinkComponent,
  Typography,
} from "@zibby/design-system";
import { PageBreadcrumb } from "../../../components/layout/PageBreadcrumb";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import { slug } from "../../../utils/slug";
import { useCompaniesQuery } from "../../companies";
import { useEntityT } from "../../entity/useEntityT";
import { useIntegrationsQuery } from "../../integrations";
import { EntityConnections } from "../../integrations/components/EntityConnections";
import { buildConnections } from "../../integrations/connectionsModel";
import { accountHref } from "../../integrations/accountHref";
import { useTeamKbNotesQuery } from "../../knowledge/queries";
import { useProjectsQuery } from "../../projects";
import { TeamKbFeed } from "../components/TeamKbFeed";
import { TeamProjectCards } from "../components/TeamProjectCards";
import { type TeamBasicsBody, TeamBasicsPanel } from "../components/TeamBasicsPanel";
import { TeamKnowledgeBasePanel } from "../components/TeamKnowledgeBasePanel";
import { LinkProjectDialog } from "../components/LinkProjectDialog";
import { useCreateTeamMutation, useDeleteTeamMutation, useUpdateTeamMutation } from "../mutations";
import { useTeamKbDigestQuery, useTeamQuery } from "../queries";

export interface TeamDetailScreenProps {
  /** The team to edit; omitted when creating a new one (the `/teams/new` route). */
  teamId?: string;
}

/**
 * `/teams/[id]` (ZB-06) — moved from `/teams/[id]` and re-skinned:
 * `MetricStrip` (projects), the linked-projects `DataTable`, and
 * `ConfirmDeleteButton` for delete. A team has no contacts/budget of its own
 * (`TeamSchema` carries neither — those stay company-only, D-003), so this
 * mirrors `CompanyDetailScreen` minus those two panels.
 */
export function TeamDetailScreen({ teamId }: TeamDetailScreenProps) {
  const t = useTranslations("teams");
  const te = useEntityT();
  const router = useRouter();

  const isNew = !teamId;
  const id = teamId ?? "";

  const teamQ = useTeamQuery(id, { enabled: !isNew });
  const projectsQ = useProjectsQuery();
  const createTeam = useCreateTeamMutation();
  const updateTeam = useUpdateTeamMutation();
  const deleteTeam = useDeleteTeamMutation();

  const [linkingProject, setLinkingProject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());
  const integrationsQ = useIntegrationsQuery();
  const { data: companies = [] } = useCompaniesQuery();
  const digestQ = useTeamKbDigestQuery(isNew ? undefined : id);
  const notesQ = useTeamKbNotesQuery(isNew ? null : id);
  const isSaving = updateTeam.isPending;

  if (!isNew && teamQ.isError) return <QueryError onRetry={() => void teamQ.refetch()} />;
  if (!isNew && teamQ.isPending) return <QueryLoading />;

  const team = isNew ? undefined : teamQ.data;

  function saveBasics(body: TeamBasicsBody) {
    if (isNew) {
      const newId = slug(body.name) || `team-${Date.now()}`;
      createTeam.mutate(
        {
          body: {
            ...body,
            logo: body.logo ?? undefined,
            companyId: body.companyId ?? undefined,
            slug: body.slug ?? undefined,
            board: body.board ?? undefined,
            id: newId,
          },
        },
        { onSuccess: () => router.replace(`/teams/${newId}` as Route) },
      );
    } else {
      updateTeam.mutate({ params: { id }, body });
    }
  }

  function saveKnowledgeBase(knowledgeBase: KnowledgeBaseSource | null) {
    updateTeam.mutate({ params: { id }, body: { knowledgeBase } });
  }

  const memberProjects = (projectsQ.data ?? []).filter((p) => p.teamId === id);
  const company = companies.find((c) => c.id === team?.companyId);
  const companyAccounts = (integrationsQ.data ?? []).filter(
    (i) => team?.companyId && i.companyId === team.companyId,
  );
  const model = buildConnections(companyAccounts, "inherited", now);
  const kb = team?.knowledgeBase;
  const noteCount = notesQ.data?.length;
  const feed = [...(digestQ.data?.decisions ?? []), ...(digestQ.data?.questions ?? [])]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 5);

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="250">
        <PageBreadcrumb
          items={[
            { label: t("title"), href: "/teams" },
            { label: isNew ? t("newTeam") : (team?.name ?? "") },
          ]}
          linkComponent={Link as SubNavLinkComponent}
        />

        {isNew && <Typography type="h1">{t("newTeam")}</Typography>}

        {!isNew && team && (
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
                    deleteTeam.mutate(
                      { params: { id } },
                      { onSuccess: () => router.push("/teams" as Route) },
                    )
                  }
                />
              </Row>
            }
            aside={
              kb ? (
                <Panel padding="150">
                  <Stack gap="50">
                    <Row gap="100">
                      <Typography type="label">{te("team.vault.title")}</Typography>
                      {/* "indexed" = the KB graph actually loaded, never a static badge. */}
                      {noteCount !== undefined && <Chip tone="ok">{te("team.vault.indexed")}</Chip>}
                    </Row>
                    <Typography mono size="xs" type="note" variant="secondary">
                      {kb.path}
                    </Typography>
                    <Row gap="150">
                      {noteCount !== undefined && (
                        <Typography mono size="xs" type="note">
                          {te("team.vault.notes", { count: noteCount })}
                        </Typography>
                      )}
                      {kb.gitRemote && (
                        <Typography mono size="xs" type="note" variant="tertiary">
                          {kb.gitRemote}
                        </Typography>
                      )}
                    </Row>
                  </Stack>
                </Panel>
              ) : undefined
            }
            eyebrow={
              <>
                <Chip>{te("team.kind")}</Chip>
                {company && (
                  <Typography size="xs" type="note">
                    {company.name}
                  </Typography>
                )}
                {team.slug && (
                  <Typography mono size="xs" type="note" variant="tertiary">
                    {te("team.codeOwner", { slug: team.slug })}
                  </Typography>
                )}
              </>
            }
            lede={team.desc}
            mark={<IconTile glyph="users" shape="circle" size="lg" src={team?.logo} />}
            summary={
              <Typography size="sm" type="note" variant="secondary">
                {te("connections.summary", { connected: model.connected })}
                {model.down.length > 0 && (
                  <>
                    {" · "}
                    <Typography as="span" size="sm" tone="bad" type="note">
                      {te("project.down", { count: model.down.length })}
                    </Typography>
                  </>
                )}
              </Typography>
            }
            title={team.name}
            variant="team"
          />
        )}

        {!isNew && team && (
          <EntityConnections
            canConnect={false}
            companyName={company?.name}
            model={model}
            onConnect={() => undefined}
            onOpen={(i) => router.push(accountHref(i))}
            ribbon={[
              ...(company
                ? [
                    {
                      kind: "company" as const,
                      label: company.name,
                      icon: "building" as const,
                      onSelect: () => router.push(`/companies/${company.id}` as Route),
                    },
                  ]
                : []),
              { kind: "team" as const, label: team.name, icon: "users" as const, current: true },
              {
                kind: "project" as const,
                label: te("company.ribbon.projects", { count: memberProjects.length }),
                icon: "grid" as const,
              },
            ]}
          />
        )}

        {(isNew || editing) && (
          <TeamBasicsPanel
            isNew={isNew}
            key={team?.id ?? "new"}
            onSave={saveBasics}
            saving={createTeam.isPending || updateTeam.isPending}
            team={team}
          />
        )}

        {!isNew && team && (
          <>
            <TeamProjectCards
              integrations={integrationsQ.data ?? []}
              onAddExisting={() => setLinkingProject(true)}
              onOpen={(pid) => router.push(`/projects/${pid}` as Route)}
              projects={memberProjects}
              t={te}
              title={t("memberProjects.title")}
            />

            <TeamKbFeed items={feed} t={te} />

            <TeamKnowledgeBasePanel
              key={`kb-${team.id}-${team.knowledgeBase ? "set" : "none"}`}
              knowledgeBase={team.knowledgeBase}
              onSave={saveKnowledgeBase}
              saving={isSaving}
            />
          </>
        )}
      </Stack>

      {linkingProject && <LinkProjectDialog onClose={() => setLinkingProject(false)} teamId={id} />}
    </Container>
  );
}
