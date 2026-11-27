"use client";

import { useTranslations } from "next-intl";
import { Button, MenuButton, Tag } from "@zibby/design-system";
import { PageActions } from "../../../components/layout/PageActions/PageActions";

export enum GoalDetailActionsTestId {
  Cycle = "goal-detail-cycle",
  Edit = "goal-detail-edit",
  Wake = "goal-detail-wake",
  Pause = "goal-detail-pause",
  Enable = "goal-detail-enable",
  More = "goal-detail-more",
}

export interface GoalDetailActionsProps {
  name: string;
  enabled: boolean;
  /** Standing goals: the engine cycle index (0-based), shown as "cyklus N". */
  cycleIndex?: number;
  editing: boolean;
  waking: boolean;
  toggling: boolean;
  onEdit: () => void;
  onWake: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

/** The goal page's context-bar actions: cycle chip, Edit, Probudit, Pozastavit/Zapnout, more (Delete). */
export function GoalDetailActions({
  name,
  enabled,
  cycleIndex,
  editing,
  waking,
  toggling,
  onEdit,
  onWake,
  onToggle,
  onDelete,
}: GoalDetailActionsProps) {
  const t = useTranslations("goals");
  const tc = useTranslations("common");
  return (
    <PageActions>
      {cycleIndex !== undefined && (
        <Tag data-testid={GoalDetailActionsTestId.Cycle} tone="neutral">
          {t("detail.cycleChip", { n: cycleIndex + 1 })}
        </Tag>
      )}
      {!editing && (
        <Button
          data-testid={GoalDetailActionsTestId.Edit}
          icon="edit"
          intent="ghost"
          onClick={onEdit}
          size="sm"
        >
          {tc("edit")}
        </Button>
      )}
      <Button
        aria-label={t("card.wakeAria", { name })}
        data-testid={GoalDetailActionsTestId.Wake}
        intent="secondary"
        loading={waking}
        onClick={onWake}
        size="sm"
      >
        {t("detail.wake")}
      </Button>
      <Button
        aria-label={t(enabled ? "card.pauseAria" : "card.enableAria", { name })}
        data-testid={enabled ? GoalDetailActionsTestId.Pause : GoalDetailActionsTestId.Enable}
        icon={enabled ? "pause" : "play"}
        intent="ink"
        loading={toggling}
        onClick={onToggle}
        size="sm"
      >
        {t(enabled ? "card.pause" : "card.enable")}
      </Button>
      <MenuButton
        ariaLabel={t("detail.more")}
        items={[
          { id: "delete", label: tc("delete"), icon: "trash", danger: true, onSelect: onDelete },
        ]}
        renderTrigger={(props) => (
          <Button
            {...props}
            aria-label={t("detail.more")}
            data-testid={GoalDetailActionsTestId.More}
            icon="dots"
            intent="ghost"
            size="sm"
          />
        )}
      />
    </PageActions>
  );
}
