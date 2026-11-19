"use client";
import { Button, Container, Kbd, Stack, Typography } from "@zibby/design-system";
import { NewTaskForm } from "../../../tasks";
import { useWdT } from "./useWdT";

export enum RunWorkflowSheetTestId {
  Root = "wd-run-sheet",
}

export interface RunWorkflowSheetProps {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}

/**
 * "Run workflow" as a small sheet anchored under the Run button (not a dialog). It is the New
 * Task form in compact mode pre-targeted at this workflow, so fields and submission are exactly
 * the existing run flow. Position it inside a positioned ancestor.
 */
export function RunWorkflowSheet({ workflowId, workflowName, onClose }: RunWorkflowSheetProps) {
  const tp = useWdT("workflowDetail.parity");
  return (
    <Container
      aria-label={tp("runSheetAria")}
      data-testid={RunWorkflowSheetTestId.Root}
      position="absolute"
      right="16px"
      role="dialog"
      style={{
        top: 52,
        width: 400,
        maxWidth: "calc(100% - 32px)",
        maxHeight: "calc(100% - 64px)",
        overflowY: "auto",
        padding: 14,
        background: "var(--color-sheet)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 12,
        boxShadow: "var(--shadow-elevated)",
        zIndex: 40,
      }}
    >
      <Stack gap="150">
        <Stack align="center" direction="row" justify="between">
          <Typography size="sm" type="note" weight="semibold">
            {tp("runSheetTitle", { name: workflowName })}
          </Typography>
          <Typography mono size="2xs" type="note" variant="tertiary">
            <Kbd>⌘↵</Kbd> · <Kbd>Esc</Kbd>
          </Typography>
        </Stack>
        <NewTaskForm
          compact
          initialTarget={{ kind: "workflow", id: workflowId, name: workflowName, glyph: "flow" }}
          onClose={onClose}
        />
        <Stack align="center" direction="row" justify="end">
          <Button intent="ghost" onClick={onClose} size="sm">
            {tp("cancel")}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
