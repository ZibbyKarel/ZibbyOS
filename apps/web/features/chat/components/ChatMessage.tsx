import { useTranslations } from "next-intl";
import {
  Button,
  Container,
  FilePreview,
  Icon,
  Markdown,
  Stack,
  ZibbyBubble,
  ZibbyOrb,
} from "@zibby/design-system";
import type {
  Attachment,
  Briefing,
  ChatMentionTarget,
  ChatMessage as ChatMessageType,
  ChatToolEvent,
} from "@zibby/contracts";
import { BriefingMessageCard } from "./BriefingMessageCard";
import {
  ChatMessageTestId,
  ChatReadAloudButton,
  ChatToolEventRows,
  ChatUserText,
  ChatWidgetCards,
  visibleToolEvents,
} from "./ChatMessageParts";
import { TargetIdentity } from "./TargetIdentity";

// The test ids and the tool-event filter live with the reusable parts.
export { ChatMessageTestId, visibleToolEvents };

/** How the operator's turn was produced — decides the meta line under their bubble. */
export type ChatMessageOrigin = "voice" | "typed";

export interface ChatMessageProps {
  role: ChatMessageType["role"];
  text: string;
  toolEvents?: ChatToolEvent[];
  /** D-020 — the units the operator `@`-mentioned on this (user) turn. */
  mentions?: ChatMentionTarget[];
  /** D-020 — this (user) turn's resolved attachment metadata. */
  attachments?: Attachment[];
  /**
   * F8a (O6) — a structured butler-briefing payload riding this (always
   * `role: "assistant"`) turn. When present it renders as a distinguishable card
   * ({@link BriefingMessageCard}) INSTEAD of the markdown bubble — `text` still
   * carries the briefing's headline as a plain-text fallback (unused by this
   * component when `briefing` is set, but read by anything that only looks at
   * `.text`, e.g. a future search over the transcript).
   */
  briefing?: Briefing;
  /** Marks the assistant turn that is still streaming (the bubble shows its live caret). */
  streaming?: boolean;
  /**
   * ZB-12 — "CREATE TASK" from a settled assistant reply: the host hands the
   * conversation up to this turn to a new task. Omit for no action.
   */
  onCreateTask?: () => void;
  /** The hand-off is being prepared (the conversation may be compacting). */
  createTaskPending?: boolean;
  /**
   * Lets an inline widget card (`toolEvents[].widget`) send a follow-up message to Zibby on the
   * operator's behalf (e.g. the CI card's "fix it"). Omit and such buttons are not rendered.
   */
  onPrompt?: (text: string) => void;
  /** User turn: the clock time shown in the meta line ("17:34"). Omit for no meta line. */
  time?: string;
  /** User turn: voice-originated ("přepis") or typed ("napsáno"); unknown shows just the time. */
  origin?: ChatMessageOrigin;
  /** Assistant turn: Zibby was cut off while reading this aloud — trails a "…". */
  interrupted?: boolean;
}

/**
 * One transcript message in the Zibby overlay's look ({@link ZibbyBubble}). User
 * turns sit to the right in a filled bubble (text, mentions, attachments and a
 * "přepis/napsáno · HH:mm" line); assistant turns are free text beside a 28 px orb
 * avatar — GitHub-flavoured markdown, tool-dispatch rows, the living run card,
 * inline widget cards and (settled turns only) the CREATE TASK / read-aloud
 * actions. While `streaming`, the bubble shows its live caret and the avatar orb
 * speaks.
 */
export function ChatMessage({
  role,
  text,
  toolEvents,
  mentions,
  attachments,
  briefing,
  streaming,
  onCreateTask,
  createTaskPending,
  onPrompt,
  time,
  origin,
  interrupted,
}: ChatMessageProps) {
  const t = useTranslations("chat");
  const tz = useTranslations("zibby");
  const isUser = role === "user";
  // Manual read-aloud (Phase 120) + CREATE TASK — only on a settled assistant turn,
  // never the live-streaming bubble (its text isn't final yet) or a user turn.
  const showActions = !isUser && !streaming && text.trim().length > 0;
  const events = toolEvents ?? [];

  if (isUser) {
    const metaLabel = !time
      ? null
      : origin === "voice"
        ? tz("thread.meta.voice", { time })
        : origin === "typed"
          ? tz("thread.meta.typed", { time })
          : time;
    return (
      <Stack align="end" data-testid={ChatMessageTestId.Root} direction="col" gap="75">
        <ZibbyBubble
          attachments={
            attachments && attachments.length > 0 ? (
              <Stack data-testid={ChatMessageTestId.Attachments} direction="col" gap="50">
                {attachments.map((file) => (
                  <FilePreview
                    key={file.name}
                    mediaType={file.mediaType}
                    name={file.name}
                    size={file.size}
                  />
                ))}
              </Stack>
            ) : undefined
          }
          author="me"
          data-testid={ChatMessageTestId.UserBubble}
          meta={
            metaLabel ? (
              <span data-testid={ChatMessageTestId.Meta}>
                {origin === "voice" && <Icon name="mic" size="sm" />}
                {metaLabel}
              </span>
            ) : undefined
          }
        >
          {/* The operator's own turn is plain text — rendered verbatim (its mentions
              marked exactly as the composer marked them), plus (D-020) the units they
              addressed and any files they attached. */}
          <Stack direction="col" gap="75">
            <ChatUserText text={text} />
            {mentions && mentions.length > 0 && (
              <Container data-testid={ChatMessageTestId.Mentions}>
                <TargetIdentity targets={mentions} />
              </Container>
            )}
          </Stack>
        </ZibbyBubble>
      </Stack>
    );
  }

  if (briefing) {
    // F8a (O6) — the structured card replaces the markdown bubble entirely (not a
    // sibling to it): a briefing turn has no prose to format, and the card is the
    // transcript-native rendering of its rows/counters.
    return (
      <Stack align="start" data-testid={ChatMessageTestId.Root} direction="col" gap="75">
        <BriefingMessageCard briefing={briefing} />
        <ChatToolEventRows events={events} streaming={Boolean(streaming)} />
        <ChatWidgetCards events={events} onPrompt={onPrompt} />
      </Stack>
    );
  }

  const hasCards =
    visibleToolEvents(events, Boolean(streaming)).length > 0 ||
    events.some((e) => e.widget !== undefined);

  return (
    <Stack align="start" data-testid={ChatMessageTestId.Root} direction="col" gap="75">
      <ZibbyBubble
        actions={
          showActions ? (
            <>
              {onCreateTask && (
                <Button
                  data-testid={ChatMessageTestId.CreateTaskButton}
                  disabled={createTaskPending}
                  intent="primary"
                  loading={createTaskPending}
                  onClick={onCreateTask}
                  size="sm"
                >
                  {t("createTask")}
                </Button>
              )}
              <ChatReadAloudButton text={text} />
            </>
          ) : undefined
        }
        author="zibby"
        avatar={<ZibbyOrb size={28} state={streaming ? "speak" : "ready"} />}
        cards={
          hasCards ? (
            <>
              <ChatToolEventRows events={events} streaming={Boolean(streaming)} />
              <ChatWidgetCards events={events} onPrompt={onPrompt} />
            </>
          ) : undefined
        }
        data-testid={ChatMessageTestId.AssistantBubble}
        streaming={streaming}
      >
        {/* ZIBBY's turn is GitHub-flavoured markdown — format it. The live caret is the
            bubble's own sibling, never part of the markdown string (so a half-typed `**`
            can't break the parse). */}
        <Markdown source={text} variant="prose" />
        {interrupted && (
          <Container as="span" data-testid={ChatMessageTestId.Interrupted}>
            {" …"}
          </Container>
        )}
      </ZibbyBubble>
    </Stack>
  );
}
