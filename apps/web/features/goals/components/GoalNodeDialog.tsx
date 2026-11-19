"use client";

import { useTranslations } from "next-intl";
import { Button, Dialog, SegmentPickerField, SelectField, Stack } from "@zibby/design-system";
import { MODEL_TIERS } from "@zibby/contracts";
import type { GoalDraft } from "../goalDraft";

export type GoalNode = "maker" | "verifier";

export interface GoalNodeOption {
  value: string;
  label: string;
}

export interface GoalNodeDialogProps {
  node: GoalNode | null;
  draft: GoalDraft;
  onChange: (patch: Partial<GoalDraft>) => void;
  onClose: () => void;
  agents: GoalNodeOption[];
  workflows: GoalNodeOption[];
}

/** Edits the maker (agent or workflow) or the verifier (agent, model tier, thinking) of a goal draft. */
export function GoalNodeDialog({
  node,
  draft,
  onChange,
  onClose,
  agents,
  workflows,
}: GoalNodeDialogProps) {
  const t = useTranslations("goalPage");
  const makerOptions = draft.makerKind === "agent" ? agents : workflows;
  return (
    <Dialog
      actions={<Button onClick={onClose}>{t("done")}</Button>}
      onClose={onClose}
      open={node !== null}
      title={node === "maker" ? t("changeMaker") : t("changeVerifier")}
      width="sm"
    >
      <Stack gap="150">
        {node === "maker" ? (
          <>
            <SegmentPickerField
              label={t("makerKind")}
              onValueChange={(v) =>
                onChange({ makerKind: v as GoalDraft["makerKind"], makerId: "" })
              }
              options={[
                { value: "agent", label: t("kindAgent") },
                { value: "workflow", label: t("kindWorkflow") },
              ]}
              value={draft.makerKind}
            />
            <SelectField
              label={t(draft.makerKind === "agent" ? "kindAgent" : "kindWorkflow")}
              onValueChange={(v) => onChange({ makerId: v })}
              options={makerOptions}
              placeholder={t("pick")}
              value={draft.makerId}
            />
          </>
        ) : (
          <>
            <SelectField
              hint={t("verifierHint")}
              label={t("verifierAgent")}
              onValueChange={(v) => onChange({ verifierAgent: v })}
              options={agents}
              placeholder={t("pick")}
              value={draft.verifierAgent}
            />
            <SegmentPickerField
              label={t("modelTier")}
              onValueChange={(v) => onChange({ verifierModel: v as GoalDraft["verifierModel"] })}
              options={[
                { value: "", label: t("agentDefault") },
                ...MODEL_TIERS.map((m) => ({ value: m, label: m })),
              ]}
              value={draft.verifierModel}
            />
            <SegmentPickerField
              label={t("thinking")}
              onValueChange={(v) =>
                onChange({ verifierThinking: v as GoalDraft["verifierThinking"] })
              }
              options={[
                { value: "", label: t("agentDefault") },
                { value: "low", label: "low" },
                { value: "medium", label: "medium" },
                { value: "high", label: "high" },
              ]}
              value={draft.verifierThinking}
            />
          </>
        )}
      </Stack>
    </Dialog>
  );
}
