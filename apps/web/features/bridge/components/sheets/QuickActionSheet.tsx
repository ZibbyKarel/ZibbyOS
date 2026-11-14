"use client";

import {
  AnchoredSheet,
  SheetAction,
  SheetBlock,
  SheetSection,
  SheetText,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAgentsQuery } from "../../../agents/queries";
import { useResolvedQuickActions } from "../../../quick-actions/useResolvedQuickActions";
import { useUpdateQuickActions } from "../../../quick-actions/useUpdateQuickActions";
import { useCreateTaskMutation } from "../../../tasks/mutations";
import { useWorkflowsQuery } from "../../../workflows/queries";
import { QuickActionForm } from "../../widgets/QuickActionForm";
import { type SheetProps, geometry } from "./sheetTypes";

export enum QuickActionSheetTestId {
  Run = "quick-action-sheet-run",
  Edit = "quick-action-sheet-edit",
}

/**
 * Quick action detail: the stored task text and target, with Run (the widget row's enqueue) and
 * an Edit button top-right; Edit swaps the body for the same form the widget's add row uses. Saving rewrites the whole list
 * (`PUT /api/quick-actions`) with this one action replaced.
 */
export function QuickActionSheet({ id, anchor, onClose, frame }: SheetProps) {
  const t = useTranslations();
  const q = useTranslations("bridge.widgets.quickActions");
  const { data: actions } = useResolvedQuickActions();
  const { data: agents } = useAgentsQuery();
  const { data: workflows } = useWorkflowsQuery();
  const { update, pending } = useUpdateQuickActions(actions ?? []);
  const create = useCreateTaskMutation();
  const [editing, setEditing] = useState(false);

  const action = actions?.find((a) => a.id === id);
  if (!action) return null;

  const catalog = action.target?.kind === "workflow" ? workflows : agents;
  const live = action.target ? catalog?.find((x) => x.id === action.target?.id) : undefined;
  const missing =
    action.target !== undefined && agents !== undefined && workflows !== undefined && !live;
  const target =
    action.target && live
      ? { ...action.target, name: live.name ?? action.target.name }
      : action.target;
  const run = () =>
    create.mutate({
      body: {
        title: action.label,
        text: action.text,
        ...(target ? { target } : {}),
        ...(action.immediate ? { immediate: true } : {}),
      },
    });

  return (
    <AnchoredSheet
      {...geometry(anchor, frame)}
      actions={
        editing ? null : (
          <>
            {action.automationId ? null : (
              <SheetAction
                data-testid={QuickActionSheetTestId.Edit}
                onClick={() => setEditing(true)}
              >
                {q("edit")}
              </SheetAction>
            )}
            <SheetAction
              data-testid={QuickActionSheetTestId.Run}
              disabled={create.isPending || missing}
              intent="primary"
              onClick={run}
            >
              {q("run")}
            </SheetAction>
          </>
        )
      }
      closeLabel={t("bridge.sheet.close")}
      copyId={id}
      footerNote={create.isSuccess ? q("queued") : missing ? q("targetMissing") : q("note")}
      glyph="bolt"
      kind={t("bridge.widgets.quickActions.kind")}
      meta={
        <Typography as="span" type="labelSm" variant="secondary">
          {[
            action.target
              ? `${action.target.kind} · ${action.target.name ?? action.target.id}`
              : q("auto"),
            action.immediate ? q("immediate") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
      }
      onClose={onClose}
      title={action.label}
    >
      {editing ? (
        <QuickActionForm
          agents={agents ?? []}
          initial={action}
          onCancel={() => setEditing(false)}
          onSubmit={(values) =>
            update(
              (latest) => latest.map((a) => (a.id === id ? { id, ...values } : a)),
              () => setEditing(false),
            )
          }
          pending={pending}
          submitLabel={q("save")}
          workflows={workflows ?? []}
        />
      ) : (
        <SheetSection>
          <SheetBlock label={q("text")}>
            <SheetText lines={action.text.split("\n")} />
          </SheetBlock>
        </SheetSection>
      )}
    </AnchoredSheet>
  );
}
