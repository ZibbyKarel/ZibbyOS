"use client";

import type { ChatMessage, ChatToolEvent } from "@zibby/contracts";
import { ZibbyThreadEmpty } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { ChatMessageOrigin } from "../../chat/components/ChatMessage";
import { ChatTranscript } from "../../chat/components/ChatTranscript";

export enum ZibbyThreadTestId {
  Empty = "zibby-thread-empty",
}

export interface ZibbyThreadProps {
  messages: ChatMessage[];
  /** Live assistant text of the in-flight turn. */
  liveText: string;
  liveToolEvents: ChatToolEvent[];
  streaming: boolean;
  /** A turn is in flight (send → terminal done/error). */
  thinking: boolean;
  onCreateTask: (messageId: string) => void;
  creatingTaskFor: string | undefined;
  /** A widget card sends a follow-up message to Zibby. */
  onPrompt: (text: string) => void;
  /** Voice / typed origin of the user turns sent in this session, by message id. */
  origins: Readonly<Record<string, ChatMessageOrigin>>;
  /** The reply Zibby was interrupted in while reading it aloud. */
  interruptedId: string | null;
}

/**
 * The overlay's conversation: {@link ChatTranscript} (markdown replies, tool rows, the living run
 * card, widget cards, the briefing card, mentions/attachments on the user's bubble, read-aloud,
 * CREATE TASK, thinking dots and the live streaming turn) in the Zibby bubble look — or, for a
 * conversation with nothing in it yet, the design's empty hint.
 */
export function ZibbyThread({
  messages,
  liveText,
  liveToolEvents,
  streaming,
  thinking,
  onCreateTask,
  creatingTaskFor,
  onPrompt,
  origins,
  interruptedId,
}: ZibbyThreadProps) {
  const t = useTranslations("zibby");
  if (messages.length === 0 && !streaming && !thinking) {
    return (
      <ZibbyThreadEmpty data-testid={ZibbyThreadTestId.Empty}>{t("thread.empty")}</ZibbyThreadEmpty>
    );
  }
  return (
    <ChatTranscript
      creatingTaskFor={creatingTaskFor}
      interruptedId={interruptedId}
      liveText={liveText}
      liveToolEvents={liveToolEvents}
      messages={messages}
      onCreateTask={onCreateTask}
      onPrompt={onPrompt}
      origins={origins}
      streaming={streaming}
      thinking={thinking}
    />
  );
}
