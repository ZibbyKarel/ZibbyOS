"use client";

import { ApprovalSheet } from "../../../approvals/components/ApprovalSheet";
import type { BridgeSelection } from "../../widgets/registry";
import { AutomationSheet } from "./AutomationSheet";
import { GoalSheet } from "./GoalSheet";
import { IssueSheet } from "./IssueSheet";
import { NoteSheet } from "./NoteSheet";
import { PrSheet } from "./PrSheet";
import { ProjectSheet } from "./ProjectSheet";
import { QuickActionSheet } from "./QuickActionSheet";
import { RunSheet } from "./RunSheet";
import { TaskSheet } from "./TaskSheet";
import { VaultNoteSheet } from "./VaultNoteSheet";
import type { SheetProps } from "./sheetTypes";

export interface SheetForSelectionProps extends Omit<SheetProps, "id"> {
  selection: BridgeSelection;
}

/**
 * The sheet of a selection's kind, keyed per item so stepping to another item never carries one
 * item's local state to the next. Shared by the bridge's `DetailSheet` and the chat overlay's
 * detail panel.
 */
export function SheetForSelection({ selection, ...rest }: SheetForSelectionProps) {
  const k = `${selection.kind}:${selection.id}`;
  const common = { id: selection.id, ...rest };
  switch (selection.kind) {
    case "issue":
      return <IssueSheet key={k} {...common} />;
    case "task":
      return <TaskSheet key={k} {...common} />;
    case "pr":
      return <PrSheet key={k} {...common} />;
    case "run":
      return <RunSheet key={k} {...common} />;
    case "quickAction":
      return <QuickActionSheet key={k} {...common} />;
    case "note":
      return <NoteSheet key={k} {...common} />;
    case "automation":
      return <AutomationSheet key={k} {...common} />;
    case "project":
      return <ProjectSheet key={k} {...common} />;
    case "goal":
      return <GoalSheet key={k} {...common} />;
    case "approval":
      return (
        <ApprovalSheet
          anchor={rest.anchor}
          approvalId={selection.id}
          frame={rest.frame}
          key={k}
          onClose={rest.onClose}
        />
      );
    case "vaultNote":
      return <VaultNoteSheet key={k} {...common} />;
  }
}
