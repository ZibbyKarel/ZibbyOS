import { useId } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Button,
  Container,
  HighlightText,
  Icon,
  Stack,
  StatusDot,
  Typography,
} from "@zibby/design-system";
import type { DotTone } from "@zibby/design-system";
import type { ChatToolEvent } from "@zibby/contracts";
import { useSystemConfigQuery } from "../../system";
import { useMentionHighlighter } from "../../tasks/hooks/useMentionHighlighter";
import { ChatWidgetCard } from "../../zibby/widgets/ChatWidgetCard";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { useSynthesizeSpeechMutation } from "../mutations/useSynthesizeSpeechMutation";
import { ChatRunCard } from "./ChatRunCard";
import { TargetIdentity } from "./TargetIdentity";

/**
 * The reusable CONTENT pieces of one transcript message (tool rows, widget cards,
 * the read-aloud action, the operator's highlighted text). `ChatMessage` assembles
 * them inside the Zibby bubble; the bubble is the only thing that differs per surface.
 */
export enum ChatMessageTestId {
  Root = "chat-message",
  Widgets = "chat-message-widgets",
  UserBubble = "chat-message-user",
  AssistantBubble = "chat-message-assistant",
  Text = "chat-message-text",
  ToolEvent = "chat-message-tool-event",
  ToolEventLink = "chat-message-tool-event-link",
  ReadAloudButton = "chat-message-read-aloud",
  CreateTaskButton = "chat-message-create-task",
  /** D-020 — the user bubble's `@mention` chip row. */
  Mentions = "chat-message-mentions",
  /** D-020 — the user bubble's attached-file row. */
  Attachments = "chat-message-attachments",
  /** The trailing "…" on a reply Zibby was interrupted while reading aloud. */
  Interrupted = "chat-message-interrupted",
  /** The user bubble's origin line ("přepis · 17:34" / "napsáno · 17:34"). */
  Meta = "chat-message-meta",
}

/** Map a tool event status onto the DS StatusDot tone. */
function toolTone(status: ChatToolEvent["status"]): DotTone {
  if (status === "error") return "bad";
  if (status === "ok") return "ok";
  return "run";
}

/**
 * todo-3: the tool calls worth showing. A `create_task` dispatch is the turn's outcome and always
 * stays; every other call is just progress — while streaming only the latest one shows (proof
 * that something is happening), and a settled turn drops them all.
 */
export function visibleToolEvents(events: ChatToolEvent[], streaming: boolean): ChatToolEvent[] {
  const isDispatch = (e: ChatToolEvent) => e.name === "create_task";
  // A widget event renders as a card (see `ChatWidgetCards`), never as a plain tool row.
  const progress = events.filter((e) => !e.widget);
  const latest = streaming ? progress.filter((e) => !isDispatch(e)).at(-1) : undefined;
  return progress.filter((e) => isDispatch(e) || e === latest);
}

function ToolEventRow({ event }: { event: ChatToolEvent }) {
  // A dispatch that has produced a run (`runRef` known — the `ok` phase of the
  // two-phase create_task event, Fáze 14.2) renders the live run card instead of
  // the flat announcement row (Fáze 14.3, Rozhodnutí 5). The `started` phase has
  // no `runRef` yet, so it still renders the flat row below — the row upgrades to
  // a card in place the instant `useChatStream` merges in the matching `ok` event
  // (same callId), with no extra state needed here.
  if (event.runRef) {
    return <ChatRunCard runRef={event.runRef} target={event.target} />;
  }

  const summary = event.summary ?? event.name;
  const body = (
    <Stack direction="col" gap="50">
      {event.target && <TargetIdentity targets={[event.target]} />}
      <Stack align="center" data-testid={ChatMessageTestId.ToolEvent} direction="row" gap="75">
        <StatusDot pulse={event.status === "started"} tone={toolTone(event.status)} />
        <Typography mono size="xs" type="note" variant="secondary">
          {summary}
        </Typography>
        {event.href && <Icon name="chevron" size="sm" tone="faint" />}
      </Stack>
    </Stack>
  );

  if (!event.href) return body;
  return (
    <Link
      data-testid={ChatMessageTestId.ToolEventLink}
      href={event.href as Route}
      style={{ display: "block", textDecoration: "none" }}
    >
      {body}
    </Link>
  );
}

export interface ChatToolEventRowsProps {
  events: ChatToolEvent[];
  streaming: boolean;
}

/** The progress / dispatch rows of a message (see {@link visibleToolEvents}). Renders nothing when none are visible. */
export function ChatToolEventRows({ events, streaming }: ChatToolEventRowsProps) {
  const shown = visibleToolEvents(events, streaming);
  if (shown.length === 0) return null;
  return (
    <Stack direction="col" gap="50">
      {shown.map((event, i) => (
        <ToolEventRow event={event} key={`${event.name}-${i}`} />
      ))}
    </Stack>
  );
}

export interface ChatWidgetCardsProps {
  events: ChatToolEvent[];
  /** Lets a card send a follow-up message to Zibby on the operator's behalf. */
  onPrompt?: (text: string) => void;
}

/** The inline widget cards (`toolEvents[].widget`) of a message. Renders nothing when there are none. */
export function ChatWidgetCards({ events, onPrompt }: ChatWidgetCardsProps) {
  const widgetEvents = events.filter((e) => e.widget !== undefined);
  if (widgetEvents.length === 0) return null;
  return (
    <Stack data-testid={ChatMessageTestId.Widgets} direction="col" gap="100">
      {widgetEvents.map((event, i) =>
        event.widget ? (
          <ChatWidgetCard
            key={event.callId ?? `${event.name}-${i}`}
            onPrompt={onPrompt}
            widget={event.widget}
          />
        ) : null,
      )}
    </Stack>
  );
}

/**
 * Manual "read aloud" trigger for one completed assistant message (Phase 120).
 * `useId()` gives this mounted instance a stable player key so
 * {@link useAudioPlayback} knows whether IT is the one currently speaking (the
 * player is a module-level singleton — only one message speaks at a time).
 * Idle → `play`; synthesizing → the `Button`'s own spinner (`loading`,
 * suppresses clicks); speaking → `stop`, clicking stops it. A failed
 * synthesize call throws and is surfaced by the app-wide mutation-error toast
 * (`MutationCache.onError`) — nothing bespoke here.
 *
 * Sends the operator's `/settings` voice pick (`SystemConfig.ttsVoice`, Phase
 * 119c) when set; omitting the key when it's `null` (the common case) lets the
 * daemon use its own default rather than sending an explicit "default" id it
 * may not recognize.
 */
export function ChatReadAloudButton({ text }: { text: string }) {
  const t = useTranslations("chat");
  const key = useId();
  const { isPlaying, play, stop } = useAudioPlayback(key);
  const synthesize = useSynthesizeSpeechMutation();
  const { data: config } = useSystemConfigQuery();

  const handleClick = () => {
    if (isPlaying) {
      stop();
      return;
    }
    synthesize.mutate(
      { body: { text, ...(config?.ttsVoice ? { voice: config.ttsVoice } : {}) } },
      { onSuccess: (result) => play(result.body.audioBase64) },
    );
  };

  const label = t(isPlaying ? "readAloudStop" : "readAloud");

  return (
    <Button
      aria-label={label}
      data-testid={ChatMessageTestId.ReadAloudButton}
      icon={isPlaying ? "stop" : "play"}
      intent="ghost"
      loading={synthesize.isPending}
      onClick={handleClick}
      size="sm"
      title={label}
    />
  );
}

/** The operator's turn text, its `@`/`#`/`/` mentions highlighted. */
export function ChatUserText({ text }: { text: string }) {
  const highlight = useMentionHighlighter();
  return (
    <Container data-testid={ChatMessageTestId.Text}>
      <HighlightText highlights={highlight(text)} text={text} />
    </Container>
  );
}
