"use client";

import { useTranslations } from "next-intl";
import type { GoalRollupStatus } from "@zibby/contracts";
import { StatusBadge } from "@zibby/design-system";
import { goalStatusTone } from "../goalView";

export interface GoalStatusBadgeProps {
  status: GoalRollupStatus;
}

/** The roll-up status pill, shared by the list card and the detail header. */
export function GoalStatusBadge({ status }: GoalStatusBadgeProps) {
  const t = useTranslations("goals.status");
  return <StatusBadge tone={goalStatusTone(status)}>{t(status)}</StatusBadge>;
}
