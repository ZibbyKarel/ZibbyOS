import { useLocale, useTranslations } from "next-intl";
import { Stack, TypingDots, ZibbyBubble, ZibbyOrb } from "@zibby/design-system";
import type { ChatMessage as ChatMessageType, ChatToolEvent } from "@zibby/contracts";
import { ChatMessage, type ChatMessageOrigin } from "./ChatMessage";

export enum ChatTranscriptTestId {
  Root = "chat-transcript",
  LiveTurn = "chat-transcript-live-turn",
  ThinkingTurn = "chat-transcript-thinking-turn",
}

export interface ChatTranscriptProps {
  /** The conversation so far, oldest first (held in the overlay's client state). */
  messages: ChatMessageType[];
  /** Live assistant text accumulating from the SSE stream (pre-commit). */
  liveText?: string;
  /** Live tool-dispatch announcements for the in-progress turn. */
  liveToolEvents?: ChatToolEvent[];
  /** Whether the live assistant turn is still streaming tokens. */
  streaming?: boolean;
  /** A turn is in flight (from send through the terminal done/error) — drives
   *  the {@link TypingDots} placeholder for the gap before any token or tool
   *  event has arrived yet (ZB-12b). */
  thinking?: boolean;
  /** ZB-12 — each settled assistant turn's "CREATE TASK" action, called with its id. */
  onCreateTask?: (messageId: string) => void;
  /** The message whose hand-off is being prepared, if any. */
  creatingTaskFor?: string;
  /** Lets inline widget cards send a follow-up message to Zibby (persisted and live turns). */
  onPrompt?: (text: string) => void;
  /** How the operator's turns sent in THIS session were produced (voice / typed), by message id.
   *  A persisted turn without an entry shows just its time. */
  origins?: Readonly<Record<string, ChatMessageOrigin>>;
  /** Id of the reply Zibby was interrupted in while reading it aloud (trails a "…"). */
  interruptedId?: string | null;
}

/** "17:34" in the app locale; `undefined` for an unparsable timestamp. */
function clockTime(at: string, locale: string): string | undefined {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * The conversation column. Renders the committed turns oldest-first, then — while a
 * turn is streaming — an extra live assistant bubble fed by the SSE deltas. On
 * `done` the stream hook hands the finished turn to the overlay (which appends it
 * to `messages`) and resets the live buffer in the same update, so the live bubble
 * gives way to the committed message with no flash and no duplicate.
 */
export function ChatTranscript({
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
}: ChatTranscriptProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const hasLive =
    Boolean(streaming) && ((liveText ?? "").length > 0 || (liveToolEvents?.length ?? 0) > 0);
  // The gap between send and the first token/tool event — `thinking` is already
  // true here, but there's nothing to render as the live turn yet.
  const isThinking = Boolean(thinking) && !hasLive;

  if (messages.length === 0 && !hasLive && !isThinking) return null;

  return (
    <Stack data-testid={ChatTranscriptTestId.Root} direction="col" gap="125">
      {messages.map((message) => (
        <ChatMessage
          attachments={message.attachments}
          briefing={message.briefing}
          createTaskPending={creatingTaskFor === message.id}
          interrupted={interruptedId === message.id}
          key={message.id}
          mentions={message.mentions}
          onCreateTask={onCreateTask && (() => onCreateTask(message.id))}
          onPrompt={onPrompt}
          origin={origins?.[message.id]}
          role={message.role}
          text={message.text}
          time={message.role === "user" ? clockTime(message.at, locale) : undefined}
          toolEvents={message.toolEvents}
        />
      ))}

      {hasLive && (
        <div data-testid={ChatTranscriptTestId.LiveTurn}>
          <ChatMessage
            onPrompt={onPrompt}
            role="assistant"
            streaming={streaming}
            text={liveText ?? ""}
            toolEvents={liveToolEvents}
          />
        </div>
      )}

      {isThinking && (
        <Stack
          align="start"
          data-testid={ChatTranscriptTestId.ThinkingTurn}
          direction="col"
          gap="75"
        >
          <ZibbyBubble author="zibby" avatar={<ZibbyOrb size={28} state="think" />}>
            <TypingDots label={t("streaming")} />
          </ZibbyBubble>
        </Stack>
      )}
    </Stack>
  );
}
