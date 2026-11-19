"use client";

import type { ChatWidget } from "@zibby/contracts";
import { ApprovalsWidgetCard } from "./ApprovalsWidgetCard";
import { BriefingWidgetCard } from "./BriefingWidgetCard";
import { CiWidgetCard } from "./CiWidgetCard";
import { IssuesWidgetCard } from "./IssuesWidgetCard";
import { MentionsWidgetCard } from "./MentionsWidgetCard";
import { ProjectStatusWidgetCard } from "./ProjectStatusWidgetCard";
import { PrsWidgetCard } from "./PrsWidgetCard";
import { RunWidgetCard } from "./RunWidgetCard";
import { RunsWidgetCard } from "./RunsWidgetCard";
import { TodoWidgetCard } from "./TodoWidgetCard";

export interface ChatWidgetCardProps {
  widget: ChatWidget;
  /** Sends a follow-up message to Zibby on the operator's behalf; absent = such buttons are hidden. */
  onPrompt?: (text: string) => void;
}

/** Renders the inline card for `widget.kind` (exhaustive — a new kind fails to compile here). */
export function ChatWidgetCard({ widget, onPrompt }: ChatWidgetCardProps) {
  switch (widget.kind) {
    case "run":
      return <RunWidgetCard widget={widget} />;
    case "runs":
      return <RunsWidgetCard widget={widget} />;
    case "prs":
      return <PrsWidgetCard widget={widget} />;
    case "issues":
      return <IssuesWidgetCard widget={widget} />;
    case "approvals":
      return <ApprovalsWidgetCard widget={widget} />;
    case "briefing":
      return <BriefingWidgetCard widget={widget} />;
    case "mentions":
      return <MentionsWidgetCard widget={widget} />;
    case "project-status":
      return <ProjectStatusWidgetCard widget={widget} />;
    case "ci":
      return <CiWidgetCard onPrompt={onPrompt} widget={widget} />;
    case "todo":
      return <TodoWidgetCard widget={widget} />;
    default: {
      const unreachable: never = widget;
      return unreachable;
    }
  }
}
