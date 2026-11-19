"use client";

import Link from "next/link";
import type { Route } from "next";
import { Button, Chip, Grid, IconTile, Panel, Row, Stack, Typography } from "@zibby/design-system";
import type { Integration, Project } from "@zibby/contracts";
import type { EntityT } from "../../entity/useEntityT";
import { projectMarks } from "../../integrations/connectionsModel";
import { sourceIcon } from "../../integrations/kindIcon";
import { ProjectCiStatusChip } from "../../projects/components/ProjectCiStatusChip";

export enum TeamProjectCardsTestId {
  Root = "team-project-cards",
  Card = "team-project-card",
  Add = "team-project-add",
}

export interface TeamProjectCardsProps {
  title: string;
  projects: Project[];
  integrations: Integration[];
  t: EntityT;
  onOpen: (projectId: string) => void;
  onAddExisting: () => void;
}

/** Member projects as entity cards: name, repo, filled/outlined service marks and CI. */
export function TeamProjectCards({
  title,
  projects,
  integrations,
  t,
  onOpen,
  onAddExisting,
}: TeamProjectCardsProps) {
  return (
    <Panel
      headerRule
      data-testid={TeamProjectCardsTestId.Root}
      header={
        <Row gap="100">
          <Typography type="h3">{title}</Typography>
          <Chip>{projects.length}</Chip>
        </Row>
      }
      headerEnd={
        <Button
          data-testid={TeamProjectCardsTestId.Add}
          icon="plus"
          intent="ghost"
          onClick={onAddExisting}
          size="sm"
        >
          {t("company.projects.addExisting")}
        </Button>
      }
      padding="200"
    >
      {projects.length === 0 ? (
        <Typography size="sm" type="note" variant="tertiary">
          {t("company.projects.empty")}
        </Typography>
      ) : (
        <Grid cols={1} gap="150" lg={3} md={2}>
          {projects.map((p) => (
            <Link
              data-testid={TeamProjectCardsTestId.Card}
              href={`/projects/${p.id}` as Route}
              key={p.id}
              onClick={(e) => {
                e.preventDefault();
                onOpen(p.id);
              }}
            >
              <Panel padding="150">
                <Stack gap="100">
                  <Typography type="label">{p.name}</Typography>
                  <Typography mono size="xs" type="note" variant="tertiary">
                    {p.gitRemote
                      ?.replace(/^(https?:\/\/|git@)/, "")
                      .replace(/:(?!\d)/, "/")
                      .replace(/\.git$/, "") ?? "—"}
                  </Typography>
                  <Row gap="100" justify="between">
                    <Row gap="50">
                      {projectMarks(p.id, p.companyId, integrations).map((m) => {
                        const icon = sourceIcon(m.kind);
                        return (
                          <IconTile
                            alt={m.kind}
                            filled={m.own}
                            glyph={icon.glyph}
                            key={m.kind}
                            size="xs"
                            src={icon.src}
                          />
                        );
                      })}
                    </Row>
                    <ProjectCiStatusChip projectId={p.id} />
                  </Row>
                </Stack>
              </Panel>
            </Link>
          ))}
        </Grid>
      )}
    </Panel>
  );
}
