"use client";

import type { CiState, Project, ProjectCi } from "@zibby/contracts";
import {
  Dropdown,
  Icon,
  type IconName,
  IconTile,
  type IconTone,
  Monogram,
  Stack,
  StateDot,
  type StateTone,
  Tile,
  TileGrid,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useQueries } from "@tanstack/react-query";
import { getProjectCiQueryKey, useProjectCiQuery, useProjectsQuery } from "../../projects/queries";
import { selectApiResponseBody } from "../../../state/selectApiResponseBody";
import type { BridgeWidgetProps, WidgetSettingsProps } from "./registry";
import { PRIORITY_WEIGHT } from "../grid/priority";
import { useWidgetReport } from "./useWidgetReport";

export enum ProjectStatusWidgetTestId {
  Ci = "project-status-ci",
  ProjectSelect = "project-status-project-select",
}

/** CI state → status glyph (the PR widget's vocabulary) and row bar tone. */
export const CI_STATE_ICON: Record<CiState, { name: IconName; tone: IconTone }> = {
  passing: { name: "ok", tone: "ok" },
  failing: { name: "x", tone: "bad" },
  running: { name: "run", tone: "run" },
  pending: { name: "clock", tone: "faint" },
  cancelled: { name: "stop", tone: "faint" },
  skipped: { name: "dots", tone: "faint" },
  none: { name: "dots", tone: "faint" },
  error: { name: "warn", tone: "warn" },
};

const DOT_TONE: Record<CiState, StateTone> = {
  passing: "done",
  failing: "error",
  running: "working",
  pending: "thinking",
  cancelled: "idle",
  skipped: "idle",
  none: "idle",
  error: "blocked",
};

/** The status glyph with its meaning as accessible name + tooltip. */
export function CiStateIcon({ state, label }: { state: CiState; label: string }) {
  const icon = CI_STATE_ICON[state];
  return (
    <span
      aria-label={label}
      data-state={state}
      data-testid={ProjectStatusWidgetTestId.Ci}
      role="img"
      title={label}
    >
      <Icon name={icon.name} size="sm" tone={icon.tone} />
    </span>
  );
}

/** The tile's state dot with the CI state as accessible name + tooltip. */
function CiStateDot({ state, label }: { state: CiState; label: string }) {
  return (
    <span
      aria-label={label}
      data-state={state}
      data-testid={ProjectStatusWidgetTestId.Ci}
      role="img"
      title={label}
    >
      <StateDot size="sm" tone={DOT_TONE[state]} />
    </span>
  );
}

/** The projects a widget shows: its `scope.projectIds` pick, or every project when none. */
export function pickedProjects(projects: readonly Project[], ids?: readonly string[]): Project[] {
  return ids?.length ? projects.filter((p) => ids.includes(p.id)) : [...projects];
}

function ProjectRow({
  project,
  widgetId,
  selection,
  onOpen,
}: {
  project: Project;
  widgetId: string;
} & Pick<BridgeWidgetProps, "selection" | "onOpen">) {
  const t = useTranslations("bridge.widgets.projectStatus");
  const { data: ci } = useProjectCiQuery(project.id);
  const state = ci?.state ?? "none";
  const key = `${widgetId}:${project.id}`;
  const red = state === "failing";
  return (
    <Tile
      alert={red}
      lead={<CiStateDot label={t(`state.${state}`)} state={state} />}
      logo={
        project.logo ? (
          <IconTile alt="" glyph="code" size="sm" src={project.logo} />
        ) : (
          <Monogram name={project.name} size={30} />
        )
      }
      onClick={() => onOpen({ kind: "project", id: project.id, widgetId, key })}
      rowKey={key}
      selected={selection?.key === key}
      sub={ci?.branch}
      title={project.name}
    />
  );
}

/**
 * Project status — tile grid species: one tile per picked project (`scope.projectIds`, absent =
 * all) with a state dot for its base-branch CI and the branch; red CI tints the whole tile rose and the widget's frame border red. Tiles keep their natural width
 * (a long name is never cut), wrap, and grow to fill each row; the logo is the project's `logo`, else a monogram.
 * A click opens the project sheet (CI by workflow → job → step).
 */
export function ProjectStatusWidget({
  widget,
  onEmptyChange,
  onCountChange,
  selection,
  onOpen,
}: BridgeWidgetProps) {
  const projectsQuery = useProjectsQuery();
  const projects = pickedProjects(projectsQuery.data ?? [], widget.scope?.projectIds);
  // Read the rows' CI straight from the cache (the rows fetch it): local state reported up from
  // the rows reset on every phone re-tier remount and looped urgency -> tier -> remount.
  const ci = useQueries({
    queries: projects.map((p) => ({
      queryKey: getProjectCiQueryKey(p.id),
      enabled: false,
      select: selectApiResponseBody<ProjectCi>,
    })),
  });
  const failing = ci.filter((q) => q.data?.state === "failing").length;
  useWidgetReport(
    {
      loading: projectsQuery.isPending,
      count: projectsQuery.isPending ? undefined : projects.length,
      you: 0,
      urgency: PRIORITY_WEIGHT.error * failing,
      alert: failing > 0,
    },
    { onEmptyChange, onCountChange },
  );
  return (
    <TileGrid>
      {projects.map((p) => (
        <ProjectRow
          key={p.id}
          onOpen={onOpen}
          project={p}
          selection={selection}
          widgetId={widget.id}
        />
      ))}
    </TileGrid>
  );
}

/** Settings: which projects the widget shows, saved as `scope.projectIds` (none = all). */
export function ProjectStatusWidgetSettings({ draft, onChange }: WidgetSettingsProps) {
  const t = useTranslations("bridge.widgets.projectStatus");
  const tf = useTranslations("bridge.filterControls");
  const { data: projects = [] } = useProjectsQuery();
  return (
    <Stack data-testid={ProjectStatusWidgetTestId.ProjectSelect} gap="75">
      <Typography size="sm" type="note" variant="secondary">
        {t("projects")}
      </Typography>
      <Dropdown
        multi
        showSelectAll
        aria-label={t("projects")}
        deselectAllLabel={tf("deselectAll")}
        onChange={(ids) =>
          onChange({ ...draft, scope: ids.length ? { projectIds: ids } : undefined })
        }
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        placeholder={t("allProjects")}
        selectAllLabel={tf("selectAll")}
        value={draft.scope?.projectIds ?? []}
      />
    </Stack>
  );
}
