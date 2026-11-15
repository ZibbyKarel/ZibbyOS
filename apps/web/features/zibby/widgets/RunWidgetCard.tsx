"use client";

import type { ChatWidget } from "@zibby/contracts";
import { ChatRunCard } from "../../chat/components/ChatRunCard";

export enum RunWidgetCardTestId {
  Root = "run-widget-card",
}

export interface RunWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "run" }>;
}

/**
 * `run` — one run as the living card. A thin wrapper: {@link ChatRunCard} already is the
 * thread's run card (same one a `create_task` dispatch upgrades to), so nothing is duplicated.
 */
export function RunWidgetCard({ widget }: RunWidgetCardProps) {
  return (
    <div data-testid={RunWidgetCardTestId.Root}>
      <ChatRunCard runRef={widget.runRef} />
    </div>
  );
}
