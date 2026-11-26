"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@zibby/design-system";
import type { CreateGoalInput } from "@zibby/contracts";
import { buildCreateGoalInput } from "../goalForm";
import { GoalForm } from "./GoalForm";

export interface GoalFormDialogProps {
  onClose: () => void;
  /** Emits the create body; the screen persists it and navigates to the detail page. */
  onCreate: (body: CreateGoalInput) => void;
  pending?: boolean;
  error?: string;
}

/** The CREATE-ONLY goal dialog — editing lives on the detail page, which mounts the same {@link GoalForm}. */
export function GoalFormDialog({ onClose, onCreate, pending, error }: GoalFormDialogProps) {
  const t = useTranslations("goals.form");
  const tk = useTranslations();
  return (
    <Dialog
      open
      ariaLabel={t("createTitle")}
      closeLabel={tk("common.close")}
      onClose={onClose}
      title={t("createTitle")}
      width="xl"
    >
      <GoalForm
        error={error}
        onCancel={onClose}
        onSubmit={(values) => onCreate(buildCreateGoalInput(values))}
        pending={pending}
        submitLabel={t("create")}
      />
    </Dialog>
  );
}
