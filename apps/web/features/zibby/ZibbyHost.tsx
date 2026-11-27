"use client";

import type { CompletedTurn } from "../chat/hooks/useChatStream";
import type { ChatMessage, TaskTarget } from "@zibby/contracts";
import {
  CanvasCard,
  StatusDot,
  ZibbyOrb,
  ZibbyOverlay,
  ZibbySuggestions,
  ZibbyToast,
  useResolvedTheme,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIsPhone } from "../../hooks/useIsPhone";
import { canvasUrls } from "../canvas/canvasUrl";
import type { CanvasKeyPayload } from "../canvas/useCanvasBridge";
import { type OpenCanvas, useChat } from "../chat/ChatContext";
import type { ChatMessageOrigin } from "../chat/components/ChatMessage";
import { useChatDock } from "../chat/hooks/useChatDock";
import type { CommandLineHandle } from "../tasks/components/CommandLine/CommandLine";
import type { TaskAttachmentSet } from "../tasks/components/TaskAttachments";
import { ZibbyCanvasPanel } from "./ZibbyCanvasPanel";
import { ZibbyDetailPanel } from "./ZibbyDetailPanel";
import { ZibbyWebPanel } from "./ZibbyWebPanel";
import { getDesktopWeb } from "../web/desktopWeb";
import { ZibbyContextChips } from "./composer/ZibbyContextChips";
import { ZibbyComposer } from "./composer/ZibbyComposer";
import { useZibbyConversations } from "./conversations";
import { ZibbyOverlayFooter } from "./footer/ZibbyOverlayFooter";
import { ZibbyHistory } from "./history/ZibbyHistory";
import { readOrbOrigin } from "./hooks/orbOrigin";
import { useOnline } from "./hooks/useOnline";
import { useTransientFlag } from "./hooks/useTransientFlag";
import { useWindowFileDrag } from "./hooks/useWindowFileDrag";
import { useZibbyCreateTask } from "./hooks/useZibbyCreateTask";
import { useZibbySummon } from "./hooks/useZibbySummon";
import { usePublishZibbyLive } from "./live/ZibbyLiveContext";
import { ZibbyLiveTranscript } from "./live/ZibbyLiveTranscript";
import { ZibbyThread } from "./thread/ZibbyThread";
import { ZibbyOverlayTopBar } from "./topbar/ZibbyOverlayTopBar";
import {
  DROP_LABEL_KEY,
  ZIBBY_VOICE_MESSAGE_KEYS,
  type ZibbyOrbState,
  type ZibbyOverlayPhase,
  deriveOrbState,
  orbStateLabelKey,
} from "./voice/orbState";
import { useSpaceToTalk } from "./voice/useSpaceToTalk";
import { type ZibbyVoice, useZibbyVoice } from "./voice/useZibbyVoice";

export enum ZibbyHostTestId {
  /** The orb's status line sits in the overlay frame; this id marks its text. */
  Status = "zibby-host-status",
}

/** Attachments per message (the server's upload limit). */
export const MAX_ATTACHED_FILES = 10;
/** localStorage key of the canvas panel's share of the overlay width. */
const CANVAS_RATIO_KEY = "zibby.canvas.ratio";

function readCanvasRatio(): number {
  try {
    const n = Number(window.localStorage.getItem(CANVAS_RATIO_KEY));
    return n > 0 && n < 1 ? n : 0.5;
  } catch {
    return 0.5;
  }
}

/** The part of a keydown the overlay shortcuts look at (a `KeyboardEvent` or a bridge `z:key`). */
type HostKey = Pick<KeyboardEvent, "key" | "code" | "altKey" | "metaKey" | "ctrlKey" | "shiftKey">;

/** The newest `canvas` widget in the thread (tool events are in order, newest last), optionally of one canvas. */
function latestCanvasWidget(messages: ChatMessage[], id?: string) {
  for (const m of [...messages].reverse()) {
    for (const e of [...(m.toolEvents ?? [])].reverse()) {
      if (e.widget?.kind === "canvas" && (id === undefined || e.widget.id === id)) return e.widget;
    }
  }
  return null;
}

/** How long the orb shows `done` / `error` after a turn ends. */
const TRANSIENT_MS = 1500;

/** Orb state → the status dot of the status line (the design's `.zstl .dot`). */
const STATUS_DOT_TONE = {
  needs: "blocked",
  error: "error",
  done: "done",
  work: "working",
  think: "working",
  search: "thinking",
} as const satisfies Partial<Record<ZibbyOrbState, string>>;

/** `listen` is also the idle-open state, so its dot only lights while the mic is live. */
function statusDotTone(state: ZibbyOrbState, micLive: boolean) {
  if (state === "listen") return micLive ? "thinking" : "idle";
  return state in STATUS_DOT_TONE ? STATUS_DOT_TONE[state as keyof typeof STATUS_DOT_TONE] : "idle";
}

/**
 * The Zibby overlay, mounted once in `AppShell` inside `ChatProvider` — it replaces the old chat
 * dock and OWNS the chat engine ({@link useChatDock}: the one and only mount app-wide, hence the
 * single SSE `EventSource`), the voice engine, the conversation history, the summon hotkey and
 * the window-level file-drag listener, and assembles the DS `ZibbyOverlay` frame from them.
 *
 * - **Open state** is `ChatContext.dockOpen` (`open()` / `openAbout()` from any screen keep
 *   working). Closes on a route change (cards and links in the thread navigate).
 * - **Summon:** the global hotkey — tap toggles, hold talks (see {@link useZibbySummon}); the
 *   header chip; any file dragged over the closed app. Flight origin = the header Zibby section orb.
 * - **Orb state** is derived (see `deriveOrbState`) from the overlay phase, the mic, the in-flight
 *   turn (+ its latest live tool event), speech, an `approvals` widget awaiting the operator
 *   (`needsDecision`), a 1.5 s `done` after a dispatch / `error` after a failure, offline
 *   (`paused`) and file dragging. It is also published to the header chip.
 * - **Voice:** Space (bare, outside text fields) is push-to-talk while the overlay is open; an
 *   utterance is sent as a message at once — through the composer, so pending attachments ride
 *   along (when the composer's submit is blocked, e.g. a turn is in flight, the words land in its
 *   draft instead of being lost). Completed replies are read aloud unless voice is off; Space /
 *   PTT interrupts. Hands-free does NOT re-arm the mic after Zibby finishes speaking — listening
 *   is always an explicit act.
 */
export function ZibbyHost() {
  const t = useTranslations("zibby");
  const tVoice = useTranslations("zibbyVoice");
  const tConversations = useTranslations("zibbyConversations");
  const compact = useIsPhone();
  const pathname = usePathname();
  const historyId = useId();
  const {
    dockOpen,
    setDockOpen,
    open,
    dockTarget,
    setDockTarget,
    about,
    setAbout,
    messages,
    model,
    setModel,
    canvas,
    canvasMode,
    openCanvas,
    closeCanvas,
    web,
    closeWeb,
    detail,
    openDetail,
    closeDetail,
    setCanvasMode,
  } = useChat();

  // ---- overlay state --------------------------------------------------------------------
  const [phase, setPhase] = useState<ZibbyOverlayPhase>("closed");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [injectedFiles, setInjectedFiles] = useState<File[] | undefined>(undefined);
  const [injectedText, setInjectedText] = useState<string | undefined>(undefined);
  /** Voice / typed origin of the user turns sent in this session (a persisted turn has none). */
  const [origins, setOrigins] = useState<Record<string, ChatMessageOrigin>>({});
  const composerHandle = useRef<CommandLineHandle>(null);
  /** The draft holds dictated words — the next send is marked as a transcript. */
  const dictatedRef = useRef(false);

  // ---- engine (the single mount) ----------------------------------------------------------
  const [justDone, flashDone] = useTransientFlag(TRANSIENT_MS);
  const [justErrored, flashError] = useTransientFlag(TRANSIENT_MS);
  const voiceRef = useRef<ZibbyVoice | null>(null);
  const openRef = useRef(dockOpen);
  useEffect(() => {
    openRef.current = dockOpen;
  });

  const { stream, thinking, send, setScope, setSkillId } = useChatDock({
    onTurnComplete: (turn: CompletedTurn) => {
      // A dispatched task (create_task / anything that produced a run) = a finished action.
      if (turn.toolEvents.some((e) => e.name.endsWith("create_task") || e.runRef !== undefined)) {
        flashDone();
      }
      // Auto-speak: read the finished reply aloud — only while the overlay is open and voice is on.
      const voice = voiceRef.current;
      if (openRef.current && voice && !voice.muted && turn.text.trim()) {
        voice.speak(turn.turnId, turn.text);
      }
    },
    onTurnError: () => flashError(),
  });

  const sendMessage = useCallback(
    (
      text: string,
      mentions: TaskTarget[] | undefined,
      attachments: TaskAttachmentSet | undefined,
      origin: ChatMessageOrigin,
    ) => {
      const id = send(text, mentions, attachments);
      if (id) setOrigins((prev) => ({ ...prev, [id]: origin }));
    },
    [send],
  );

  /** `CommandLine.onSubmit` (Enter / send button / a spoken utterance routed through the composer). */
  const sendFromComposer = useCallback(
    (text: string, mentions?: TaskTarget[], attachments?: TaskAttachmentSet) => {
      const origin: ChatMessageOrigin = dictatedRef.current ? "voice" : "typed";
      dictatedRef.current = false;
      sendMessage(text, mentions, attachments, origin);
    },
    [sendMessage],
  );

  // A finished dictation lands in the composer (focused, caret at the end) so the operator can
  // fix it before Enter sends it.
  const onUtterance = useCallback((text: string) => {
    dictatedRef.current = true;
    setInjectedText((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  /** `ask` / "Fix it" from the canvas: into the composer, never sent. */
  const onCanvasPrefill = useCallback((text: string) => {
    setInjectedText((prev) => (prev ? `${prev}\n\n${text}` : text));
  }, []);
  /** An approved `propose`: sent as the operator's own typed message. */
  const onCanvasSend = useCallback(
    (text: string) => sendMessage(text, undefined, undefined, "typed"),
    [sendMessage],
  );

  // ---- voice ---------------------------------------------------------------------------
  const voice = useZibbyVoice({ enabled: dockOpen, onUtterance });
  useEffect(() => {
    voiceRef.current = voice;
  });

  useSpaceToTalk({
    enabled: dockOpen && phase === "open",
    onDown: voice.pressTalk,
    onUp: voice.releaseTalk,
  });

  // ---- summon / dismiss -------------------------------------------------------------------
  useZibbySummon({
    open: dockOpen,
    setOpen: (next) => (next ? open() : setDockOpen(false)),
    phase,
    pressTalk: voice.pressTalk,
    releaseTalk: voice.releaseTalk,
    cancelTalk: voice.cancelTalk,
  });

  // Cards and links in the thread navigate — leave the overlay behind on a route change.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    setDockOpen(false);
  }, [pathname, setDockOpen]);

  // Every open puts the caret in the input, so typing can start at once. Runs after the DS
  // overlay's own focus move (child effects first).
  const focusedOnOpen = useRef(false);
  useEffect(() => {
    if (phase === "closed" || phase === "leaving") {
      focusedOnOpen.current = false;
    } else if (!focusedOnOpen.current) {
      focusedOnOpen.current = true;
      composerHandle.current?.focus();
    }
  }, [phase]);

  // A file dragged over the closed app summons Zibby with the drop zone showing.
  useWindowFileDrag(!dockOpen, () => {
    open();
    setDragging(true);
  });
  const onFilesDrop = useCallback((files: File[]) => {
    setInjectedFiles(files.slice(0, MAX_ATTACHED_FILES));
  }, []);

  // Where the orb flies from / back to: the header Zibby section's orb (measured whenever the open flag flips).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const origin = useMemo(() => readOrbOrigin(), [dockOpen]);

  // ---- conversations -----------------------------------------------------------------------
  const conversations = useZibbyConversations({ busy: thinking });
  const { createTask, pendingFor } = useZibbyCreateTask();

  // While the overlay is open: ⌥ H history, ⌥ N new chat, ⌥ C clear (`event.code` — Option
  // changes `event.key` on macOS), ⌘⇧↵ canvas full/back, ⌘\ close / reopen the last canvas.
  // Also fed by the canvas bridge (`z:key`), so the same keys work with focus inside the iframe.
  const { startNew, clearActive } = conversations;
  const lastCanvas = useRef<OpenCanvas | null>(null);
  useEffect(() => {
    if (canvas) lastCanvas.current = canvas;
  });
  const handleHostKey = useCallback(
    (k: HostKey): boolean => {
      if (k.ctrlKey) return false;
      if (k.altKey && !k.metaKey && !k.shiftKey) {
        if (k.code === "KeyH") setHistoryOpen((prev) => !prev);
        else if (k.code === "KeyN") startNew();
        else if (k.code === "KeyC") clearActive();
        else return false;
        return true;
      }
      if (compact || k.altKey || !k.metaKey) return false;
      if (k.shiftKey && k.key === "Enter" && canvas) {
        setCanvasMode(canvasMode === "full" ? "split" : "full");
        return true;
      }
      if (!k.shiftKey && (k.key === "\\" || k.code === "Backslash")) {
        if (canvas) closeCanvas();
        else if (lastCanvas.current) openCanvas(lastCanvas.current);
        else return false;
        return true;
      }
      return false;
    },
    [compact, canvas, canvasMode, startNew, clearActive, setCanvasMode, closeCanvas, openCanvas],
  );
  useEffect(() => {
    if (!dockOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (handleHostKey(event)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dockOpen, handleHostKey]);

  /** Esc: full → split, else close the canvas (the overlay's own Esc order, for the iframe). */
  const dismissCanvas = useCallback(
    (mode: "split" | "full") => {
      if (mode === "full") return setCanvasMode("split");
      // One thing occupies the side slot at a time — close whichever it is.
      closeCanvas();
      closeWeb();
      closeDetail();
    },
    [setCanvasMode, closeCanvas, closeWeb, closeDetail],
  );
  /** `z:key` from the canvas page. ⌥Space is the summon chip's toggle — the overlay is open, so it closes. */
  const onCanvasKey = useCallback(
    (k: CanvasKeyPayload) => {
      if (k.key === "Escape") dismissCanvas(canvasMode);
      else if (k.altKey && !k.metaKey && !k.shiftKey && k.code === "Space") setDockOpen(false);
      else handleHostKey(k);
    },
    [dismissCanvas, canvasMode, handleHostKey, setDockOpen],
  );

  // Canvas panel width share, remembered across sessions.
  const [canvasRatio, setCanvasRatio] = useState(readCanvasRatio);
  const onCanvasRatioChange = useCallback((ratio: number) => {
    setCanvasRatio(ratio);
    try {
      window.localStorage.setItem(CANVAS_RATIO_KEY, String(ratio));
    } catch {
      // Storage unavailable — the ratio still applies for this session.
    }
  }, []);

  // The open canvas follows newer versions of itself in the thread (publish / set_canvas_params).
  const followVersion = canvas ? latestCanvasWidget(messages, canvas.id)?.version : undefined;
  useEffect(() => {
    if (canvas && followVersion !== undefined && followVersion > canvas.version) {
      openCanvas({ ...canvas, version: followVersion });
      setCanvasMode(canvasMode); // openCanvas resets to split; keep full
    }
  }, [canvas, canvasMode, followVersion, openCanvas, setCanvasMode]);

  // Phone: the newest canvas of the thread, pinned as a small thumbnail (tap opens the browser).
  const resolvedTheme = useResolvedTheme();
  const pinWidget = compact ? latestCanvasWidget(messages) : null;
  const pinUrls = pinWidget ? canvasUrls(pinWidget.id, pinWidget.version, resolvedTheme) : null;
  const pinnedCanvas =
    pinWidget && pinUrls?.external ? (
      <CanvasCard
        colorScheme={resolvedTheme}
        href={pinUrls.external}
        size="pin"
        src={pinUrls.frame ?? pinUrls.external}
        title={pinWidget.title}
        version={pinWidget.version}
      />
    ) : undefined;

  // ---- orb ----------------------------------------------------------------------------------
  const online = useOnline();
  const lastMessage = messages.at(-1);
  // Something awaits the operator: the last reply (or the live turn) carries an `approvals` card.
  const needsDecision = (
    stream.streaming
      ? stream.toolEvents
      : lastMessage?.role === "assistant"
        ? (lastMessage.toolEvents ?? [])
        : []
  ).some((e) => e.widget?.kind === "approvals");
  const orbState = deriveOrbState({
    phase,
    listening: voice.listening,
    thinking: thinking || voice.transcribing,
    lastToolEvent: stream.toolEvents.at(-1) ?? null,
    streamingText: stream.text.length > 0,
    speaking: voice.speaking,
    needsDecision,
    justDone,
    justErrored,
    paused: !online,
    dragging,
  });

  const publish = usePublishZibbyLive();
  useEffect(() => {
    publish({ phase, orbState });
  }, [publish, phase, orbState]);

  const statusText = dragging ? tVoice(DROP_LABEL_KEY) : tVoice(orbStateLabelKey(orbState));
  const hint = voice.hint
    ? tVoice(ZIBBY_VOICE_MESSAGE_KEYS[voice.hint])
    : voice.error
      ? tVoice(ZIBBY_VOICE_MESSAGE_KEYS[voice.error])
      : null;

  const desktopWeb = getDesktopWeb();
  const threadEmpty = messages.length === 0;
  const showSuggestions = threadEmpty && !thinking && !stream.streaming;
  const prompt = (text: string) => sendMessage(text, undefined, undefined, "typed");
  const toast = conversations.toast;

  return (
    <ZibbyOverlay
      attachments={
        dockTarget || about ? (
          <ZibbyContextChips
            about={about}
            onClearAbout={() => setAbout(null)}
            onClearTarget={() => setDockTarget(null)}
            target={dockTarget}
          />
        ) : undefined
      }
      compact={compact}
      composer={
        <ZibbyComposer
          compact={compact}
          handleRef={composerHandle}
          injectedFiles={injectedFiles}
          injectedText={injectedText}
          level={voice.level}
          listening={voice.listening}
          mode={voice.mode}
          model={model}
          onInjectedFilesConsumed={() => setInjectedFiles(undefined)}
          onInjectedTextConsumed={() => setInjectedText(undefined)}
          onModelChange={setModel}
          onPressTalk={voice.pressTalk}
          onReleaseTalk={voice.releaseTalk}
          onScopeChange={setScope}
          onSend={sendFromComposer}
          onSkillChange={setSkillId}
          thinking={thinking}
        />
      }
      dropActive={dragging}
      dropHint={t("drop.hint")}
      dropTitle={t("drop.title")}
      footer={
        <ZibbyOverlayFooter
          compact={compact}
          mode={voice.mode}
          muted={voice.muted}
          onModeChange={voice.setMode}
          onMutedChange={voice.setMuted}
          voiceUnavailable={!voice.ttsAvailable}
        />
      }
      hint={hint}
      history={<ZibbyHistory conversations={conversations} onClose={() => setHistoryOpen(false)} />}
      historyLabel={t("history.label")}
      historyOpen={historyOpen}
      label={t("label")}
      live={<ZibbyLiveTranscript transcript={voice.transcript} />}
      onDragActiveChange={setDragging}
      onFilesDrop={onFilesDrop}
      onHistoryOpenChange={setHistoryOpen}
      onOpenChange={setDockOpen}
      onPhaseChange={(next) => {
        setPhase(next);
        if (next === "closed") {
          setHistoryOpen(false);
          setDragging(false);
        }
      }}
      onSideDismiss={dismissCanvas}
      onSideRatioChange={onCanvasRatioChange}
      open={dockOpen}
      orb={<ZibbyOrb level={voice.level} size={140} state={orbState} />}
      origin={origin}
      pinned={pinnedCanvas}
      scrollKey={`${messages.length}:${stream.text.length}:${thinking}`}
      side={
        canvas && !compact ? (
          <ZibbyCanvasPanel
            canvas={canvas}
            key={canvas.id}
            onKey={onCanvasKey}
            onPrefill={onCanvasPrefill}
            onSend={onCanvasSend}
          />
        ) : detail && !compact ? (
          <ZibbyDetailPanel
            full={canvasMode === "full"}
            onClose={closeDetail}
            onOpen={openDetail}
            onToggleFull={() => setCanvasMode(canvasMode === "full" ? "split" : "full")}
            selection={detail}
          />
        ) : web && !compact && desktopWeb ? (
          <ZibbyWebPanel
            desktop={desktopWeb}
            full={canvasMode === "full"}
            onClose={closeWeb}
            onToggleFull={() => setCanvasMode(canvasMode === "full" ? "split" : "full")}
            page={web}
          />
        ) : undefined
      }
      sideMode={canvasMode}
      sideRatio={canvasRatio}
      status={
        <>
          <StatusDot tone={statusDotTone(orbState, voice.listening)} />
          <span data-testid={ZibbyHostTestId.Status}>{statusText}</span>
        </>
      }
      suggestions={
        showSuggestions ? (
          <ZibbySuggestions
            items={[
              { label: t("suggestions.today"), onSelect: () => prompt(t("suggestions.today")) },
              {
                label: t("suggestions.approvals"),
                onSelect: () => prompt(t("suggestions.approvals")),
              },
              { label: t("suggestions.prs"), onSelect: () => prompt(t("suggestions.prs")) },
            ]}
            label={t("suggestions.label")}
            lead={t("suggestions.lead")}
          />
        ) : undefined
      }
      thread={
        <ZibbyThread
          creatingTaskFor={pendingFor}
          interruptedId={voice.interruptedId}
          liveText={stream.text}
          liveToolEvents={stream.toolEvents}
          messages={messages}
          onCreateTask={createTask}
          onPrompt={prompt}
          origins={origins}
          streaming={stream.streaming}
          thinking={thinking}
        />
      }
      toast={
        toast ? (
          <ZibbyToast
            actionLabel={toast.undo ? tConversations("toast.undo") : undefined}
            message={toast.message}
            onAction={toast.undo}
          />
        ) : undefined
      }
      topBar={
        <ZibbyOverlayTopBar
          compact={compact}
          conversations={conversations}
          historyControls={historyId}
          historyOpen={historyOpen}
          onClose={() => setDockOpen(false)}
          onHistoryToggle={() => setHistoryOpen((prev) => !prev)}
          threadEmpty={threadEmpty}
        />
      }
    />
  );
}
