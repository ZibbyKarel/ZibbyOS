"use client";

import {
  Button,
  Chip,
  DataTable,
  type DataTableColumn,
  IconTile,
  Panel,
  Row,
  Typography,
} from "@zibby/design-system";
import type { Integration, Project } from "@zibby/contracts";
import { type EntityT } from "../../entity/useEntityT";
import { projectMarks } from "../../integrations/connectionsModel";
import { sourceIcon } from "../../integrations/kindIcon";

export enum CompanyProjectsPanelTestId {
  Root = "company-projects-panel",
  Add = "company-projects-add",
}

interface Row_ {
  id: string;
  name: string;
  team?: string;
  repo?: string;
  marks: ReturnType<typeof projectMarks>;
  runs30d: number;
}

export interface CompanyProjectsPanelProps {
  companyId: string;
  projects: Project[];
  teamNames: Record<string, string>;
  integrations: Integration[];
  /** Runs started in the last 30 days, by project id. */
  runs30d: Record<string, number>;
  t: EntityT;
  onOpen: (projectId: string) => void;
  onAddExisting: () => void;
}

/** The "Projects" table of the company page: team, repo, filled/outlined service marks, 30-day runs. */
export function CompanyProjectsPanel({
  companyId,
  projects,
  teamNames,
  integrations,
  runs30d,
  t,
  onOpen,
  onAddExisting,
}: CompanyProjectsPanelProps) {
  const rows: Row_[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.teamId ? teamNames[p.teamId] : undefined,
    repo: p.gitRemote
      ?.replace(/^(https?:\/\/|git@|ssh:\/\/git@)/, "")
      .replace(/:(?!\d)/, "/")
      .replace(/\.git$/, ""),
    marks: projectMarks(p.id, companyId, integrations),
    runs30d: runs30d[p.id] ?? 0,
  }));
  const columns: DataTableColumn<Row_>[] = [
    { key: "name", label: t("company.projects.project"), width: "lg", render: (r) => r.name },
    { key: "team", label: t("company.projects.team"), width: "md", render: (r) => r.team ?? "—" },
    {
      key: "repo",
      label: t("company.projects.repo"),
      width: "flex",
      render: (r) => (
        <Typography mono size="xs" type="note" variant="secondary">
          {r.repo ?? "—"}
        </Typography>
      ),
    },
    {
      key: "marks",
      label: t("company.projects.marks"),
      width: "xl",
      render: (r) => (
        <Row gap="50">
          {r.marks.map((m) => {
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
      ),
    },
    {
      key: "runs",
      label: t("company.projects.runs"),
      width: "sm",
      render: (r) => String(r.runs30d),
    },
  ];
  return (
    <Panel
      headerRule
      data-testid={CompanyProjectsPanelTestId.Root}
      header={
        <Row gap="100">
          <Typography type="h3">{t("company.projects.title")}</Typography>
          <Chip>{rows.length}</Chip>
        </Row>
      }
      headerEnd={
        <Button
          data-testid={CompanyProjectsPanelTestId.Add}
          icon="plus"
          intent="ghost"
          onClick={onAddExisting}
          size="sm"
        >
          {t("company.projects.addExisting")}
        </Button>
      }
      padding="0"
    >
      <DataTable
        columns={columns}
        empty={
          <Typography size="sm" type="note" variant="tertiary">
            {t("company.projects.empty")}
          </Typography>
        }
        getRowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
        rows={rows}
      />
    </Panel>
  );
}
