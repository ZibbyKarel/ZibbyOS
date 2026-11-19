"use client";

import type { DepartmentWithStatus } from "@zibby/contracts";
import {
  CodeTile,
  ListCard,
  Stack,
  StatCells,
  StatePill,
  TextLink,
  Typography,
} from "@zibby/design-system";
import type { SubNavLinkComponent } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { DEPARTMENT_TABS } from "../departmentTabs";
import { departmentPillTone } from "../departmentListState";
import { useDepartmentSubtasksQuery } from "../queries";

export interface DepartmentCardProps {
  department: DepartmentWithStatus;
  /** Number of agents owned by this department. */
  agentCount: number;
  onOpen?: (department: DepartmentWithStatus) => void;
}

/**
 * Department "door-plate" card (design Seznamy "Oddělení"): mono code tile, name, status
 * pill while something is going on, mandate, a KPI strip (open subtasks, agents — runs
 * and spend today have no per-department source yet) and links to the detail tabs.
 */
export function DepartmentCard({ department, agentCount, onOpen }: DepartmentCardProps) {
  const t = useTranslations("departmentDetail");
  const subtasks = useDepartmentSubtasksQuery(department.id);
  const open = (subtasks.data ?? []).filter((s) => s.state !== "done").length;
  const tone = departmentPillTone(department.state);

  return (
    <ListCard
      onOpen={() => onOpen?.(department)}
      openLabel={t("openDepartment", { name: department.name })}
    >
      <Stack align="center" direction="row" gap="200">
        <CodeTile code={department.code} />
        <Stack grow gap="50">
          <Typography truncate size="lg" type="note" weight="semibold">
            {department.name}
          </Typography>
          {tone && <StatePill label={t(`state.${tone}`)} state={tone} />}
        </Stack>
      </Stack>
      <Typography leading="snug" size="sm" type="note" variant="secondary">
        {department.mandate}
      </Typography>
      <StatCells
        items={[
          { id: "subtasks", label: t("kpiOpenSubtasks"), value: subtasks.isPending ? "…" : open },
          { id: "agents", label: t("kpiAgents"), value: agentCount },
        ]}
      />
      <Stack wrap direction="row" gap="200">
        {DEPARTMENT_TABS.map((tab) => (
          <TextLink
            href={`/workforce/departments/${department.id}/${tab}` as Route}
            key={tab}
            linkComponent={Link as SubNavLinkComponent}
          >
            <Typography as="span" size="caption" type="note" variant="tertiary">
              {t(`tabs.${tab}`)}
            </Typography>
          </TextLink>
        ))}
      </Stack>
    </ListCard>
  );
}
