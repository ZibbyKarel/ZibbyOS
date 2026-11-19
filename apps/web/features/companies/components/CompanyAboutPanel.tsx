"use client";

import Link from "next/link";
import type { Route } from "next";
import { Button, Chip, Panel, Row, Stack, Typography } from "@zibby/design-system";
import type { Team } from "@zibby/contracts";
import type { EntityT } from "../../entity/useEntityT";

export enum CompanyAboutPanelTestId {
  Root = "company-about-panel",
  Tasks = "company-about-tasks",
}

export interface CompanyAboutPanelProps {
  slug: string;
  teams: Team[];
  tasksLabel: string;
  onOpenTasks: () => void;
  t: EntityT;
}

/** Slug, teams and the "all tasks for this company" row. No created date: the record has none. */
export function CompanyAboutPanel({
  slug,
  teams,
  tasksLabel,
  onOpenTasks,
  t,
}: CompanyAboutPanelProps) {
  return (
    <Panel
      headerRule
      data-testid={CompanyAboutPanelTestId.Root}
      header={<Typography type="h3">{t("company.about.title")}</Typography>}
      padding="200"
    >
      <Stack gap="150">
        <Row gap="150" justify="between">
          <Typography size="sm" type="note" variant="tertiary">
            {t("company.about.slug")}
          </Typography>
          <Typography mono size="sm" type="note">
            {slug}
          </Typography>
        </Row>
        <Row gap="150" justify="between">
          <Typography size="sm" type="note" variant="tertiary">
            {t("company.about.teams")}
          </Typography>
          <Row wrap gap="75">
            {teams.length === 0 ? (
              <Typography size="sm" type="note" variant="tertiary">
                —
              </Typography>
            ) : (
              teams.map((team) => (
                <Link href={`/teams/${team.id}` as Route} key={team.id}>
                  <Chip>{team.name}</Chip>
                </Link>
              ))
            )}
          </Row>
        </Row>
        <Button
          data-testid={CompanyAboutPanelTestId.Tasks}
          intent="ghost"
          onClick={onOpenTasks}
          size="sm"
        >
          {tasksLabel}
        </Button>
      </Stack>
    </Panel>
  );
}
