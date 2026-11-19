"use client";
import { Button, Container, MenuButton, Stack, Tag, Typography } from "@zibby/design-system";
import { PinButton } from "../../../pins";
import type { GraphProblem } from "../WorkflowDialog/workflow-graph";
import { useWdT } from "./useWdT";

export enum WorkflowBarTestId {
  Root = "wd-bar",
  Back = "wd-bar-back",
  Dirty = "wd-bar-dirty",
  Problems = "wd-bar-problems",
  Edit = "wd-bar-edit",
  Cancel = "wd-bar-cancel",
  Save = "wd-bar-save",
  Duplicate = "wd-bar-duplicate",
  Run = "wd-bar-run",
}

export interface WorkflowBarProps {
  workflowId: string;
  name: string;
  file: string;
  /** Resolved department name, absent when the workflow has none. */
  department?: string;
  /** Breadcrumb root label ("Workflows") and its click handler. */
  onBack: () => void;
  editing: boolean;
  dirty: boolean;
  saving: boolean;
  problems: readonly GraphProblem[];
  /** Human line for one problem, e.g. "Review · pick an agent". */
  problemLabel: (problem: GraphProblem) => string;
  onSelectProblem: (nodeId: string | undefined) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  onRun: () => void;
  onCopyFile: () => void;
}

/** Top bar of the workflow page: breadcrumb, state, problems, and the page actions. */
export function WorkflowBar(p: WorkflowBarProps) {
  const t = useWdT("workflowDetail.bar");
  const canSave = p.dirty && p.problems.length === 0 && !p.saving;
  return (
    <Container
      data-testid={WorkflowBarTestId.Root}
      padding={["100", "200"]}
      shrink={false}
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <Stack wrap align="center" direction="row" gap="150" justify="between">
        <Stack align="center" direction="row" gap="100">
          <Button data-testid={WorkflowBarTestId.Back} intent="ghost" onClick={p.onBack} size="sm">
            {t("workflows")}
          </Button>
          <Typography size="sm" type="note" variant="tertiary">
            /
          </Typography>
          <Typography truncate size="sm" type="note" weight="semibold">
            {p.name}
          </Typography>
          {p.department && <Tag>{p.department}</Tag>}
          {p.editing && p.dirty && (
            <Tag data-testid={WorkflowBarTestId.Dirty} tone="warn">
              {t("unsaved")}
            </Tag>
          )}
        </Stack>
        <Stack align="center" direction="row" gap="100">
          {p.editing && p.problems.length > 0 && (
            <MenuButton
              ariaLabel={t("problems", { n: p.problems.length })}
              items={p.problems.map((problem, i) => ({
                id: `${problem.kind}-${problem.nodeId ?? "wf"}-${i}`,
                label: p.problemLabel(problem),
                icon: "warn" as const,
                onSelect: () => p.onSelectProblem(problem.nodeId),
              }))}
              renderTrigger={(props) => (
                <Button
                  {...props}
                  data-testid={WorkflowBarTestId.Problems}
                  icon="warn"
                  intent="ghost"
                  size="sm"
                >
                  {t("problems", { n: p.problems.length })}
                </Button>
              )}
            />
          )}
          <PinButton id={p.workflowId} kind="workflow" />
          {p.editing ? (
            <>
              <Button
                data-testid={WorkflowBarTestId.Cancel}
                intent="ghost"
                onClick={p.onCancel}
                size="sm"
              >
                {t("cancel")}
              </Button>
              <Button
                data-testid={WorkflowBarTestId.Save}
                disabled={!canSave}
                icon="check"
                intent="primary"
                loading={p.saving}
                onClick={p.onSave}
                size="sm"
              >
                {t("save")}
              </Button>
            </>
          ) : (
            <>
              <Button
                data-testid={WorkflowBarTestId.Edit}
                icon="edit"
                intent="ghost"
                onClick={p.onEdit}
                size="sm"
              >
                {t("edit")}
              </Button>
              <Button
                data-testid={WorkflowBarTestId.Duplicate}
                disabled={p.duplicating}
                icon="link"
                intent="ghost"
                onClick={p.onDuplicate}
                size="sm"
              >
                {t("duplicate")}
              </Button>
              <Button
                data-testid={WorkflowBarTestId.Run}
                icon="play"
                intent="primary"
                onClick={p.onRun}
                size="sm"
              >
                {t("run")}
              </Button>
            </>
          )}
          <MenuButton
            ariaLabel={t("more")}
            items={[
              { id: "copy-file", label: t("copyFile", { file: p.file }), onSelect: p.onCopyFile },
            ]}
          />
        </Stack>
      </Stack>
    </Container>
  );
}
