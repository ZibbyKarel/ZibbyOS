"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  playAudioPlayback,
  stopAudioPlayback,
  useAnyAudioPlaying,
} from "../../chat/hooks/useAudioPlayback";
import { useDictationRecorder } from "../../chat/hooks/useDictationRecorder";
import {
  type SpeechRecognitionErrorKind,
  useSpeechRecognition,
} from "../../chat/hooks/useSpeechRecognition";
import { localeToLang } from "../../chat/hooks/useVoiceMode";
import { useSynthesizeSpeechMutation } from "../../chat/mutations/useSynthesizeSpeechMutation";
import { useSpeechStatusQuery } from "../../chat/queries";
import { useSystemConfigQuery } from "../../system";
import { chunkForSpeech, toSpeakableText } from "./speakableText";
import { useMicLevel } from "./useMicLevel";
import {
  type ZibbyVoiceMode,
  readStoredMode,
  readStoredMuted,
  writeStoredMode,
  writeStoredMuted,
} from "./voicePrefs";

export type { ZibbyVoiceMode };

export interface ZibbyVoiceOptions {
  /** Overlay is open. When `false` everything is torn down (mic off, playback stopped). */
  enabled: boolean;
  /** A finished utterance, to be SENT as a message (voice-originated). */
  onUtterance: (text: string) => void;
}

export interface ZibbyVoiceTranscript {
  /** Confirmed words (UI: white). */
  final: string;
  /** In-progress tail (UI: grey). */
  interim: string;
}

export type ZibbyVoiceError = "mic-denied" | "unavailable";

export interface ZibbyVoice {
  /** STT available at all (browser or server path). */
  supported: boolean;
  mode: ZibbyVoiceMode;
  setMode: (mode: ZibbyVoiceMode) => void;
  listening: boolean;
  transcript: ZibbyVoiceTranscript;
  /** Server-side finalisation in progress (dictation-recorder path only). */
  transcribing: boolean;
  /** 0–1 live mic level while listening; 0 when unavailable. */
  level: number;
  hint: "tooShort" | null;
  /** PTT down / hands-free start (hands-free: when already listening, ends the utterance). Interrupts Zibby first. */
  startTalk: () => void;
  /** Ends listening and sends (see {@link ZibbyVoiceOptions.onUtterance}). Ignored in hands-free within 300 ms of start. */
  stopTalk: () => void;
  /** Abort without sending. */
  cancelTalk: () => void;
  /** Mode-aware key/button down: PTT → `startTalk`; hands-free → toggle. Wire this to `useSpaceToTalk.onDown`. */
  pressTalk: () => void;
  /** Mode-aware key/button up: PTT → `stopTalk`; hands-free → no-op. Wire this to `useSpaceToTalk.onUp`. */
  releaseTalk: () => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /** A reply is being read aloud (synthesising or playing), by us or a manual read-aloud. */
  speaking: boolean;
  /** Id (as passed to `speak`) of the reply being read, or `null`. */
  speakingId: string | null;
  /** 0–1 output level; always `0` today (the shared player exposes no analyser). */
  speakLevel: number;
  /** Id of the reply last cut off by `interrupt()` — the container marks it "…". Reset by the next `speak`. */
  interruptedId: string | null;
  /** Reads a completed reply aloud; no-op when muted / TTS unavailable / the operator is talking. A new call replaces the current one. */
  speak: (messageId: string, text: string) => void;
  /** Stops TTS now; returns the id of the reply that was cut (or `null`). */
  interrupt: () => string | null;
  error: ZibbyVoiceError | null;
}

/** A PTT hold shorter than this is not speech. */
export const MIN_HOLD_MS = 300;
/** Hands-free: silence after speech that ends the utterance. */
export const HANDSFREE_SILENCE_MS = 800;
/** Level above which the mic counts as "hearing speech". */
export const SPEECH_LEVEL = 0.12;
/** Web Speech: wait this long after stop for the recogniser to flush its final result. */
export const FLUSH_GRACE_MS = 700;
/** Web Speech: once a final landed during the grace, wait only this long for a trailing one. */
export const FLUSH_TAIL_MS = 150;
/** Recorder path: give up waiting for the server transcript after this long. */
export const TRANSCRIBE_TIMEOUT_MS = 20_000;
/** The "too short" hint disappears by itself after this long. */
export const HINT_MS = 4_000;
const SILENCE_TICK_MS = 100;

type Phase = "idle" | "listening" | "finalizing";
type Engine = "recorder" | "speech";

interface Session {
  phase: Phase;
  engine: Engine;
  startedAt: number;
  finalText: string;
  lastInterim: string;
  lastActivity: number;
  hasSpeech: boolean;
  /** Engine start postponed until /speech/status is known. */
  deferred: boolean;
  /** Recorder transcripts still to come from sessions we cancelled. */
  staleFinals: number;
  flushTimer: ReturnType<typeof setTimeout> | undefined;
  silenceTimer: ReturnType<typeof setInterval> | undefined;
  hintTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * The voice engine of the Zibby overlay: push-to-talk / hands-free dictation and spoken
 * replies, built on the chat voice hooks.
 *
 * STT path: the dictation recorder (server transcription) when `/speech/status` reports
 * local STT available and the runtime can record; otherwise the browser Web Speech API —
 * exactly the rule `useVoiceMode` uses. Language follows the app locale (`cs-CZ` default).
 *
 * Echo guard: the mic is never live while Zibby speaks — `startTalk` interrupts playback
 * first, a reply that begins playing (e.g. manual read-aloud) cancels a live session, and
 * `speak` is a no-op while the operator is talking.
 */
export function useZibbyVoice({ enabled, onUtterance }: ZibbyVoiceOptions): ZibbyVoice {
  const locale = useLocale();
  const lang = localeToLang(locale);

  // Persisted prefs: defaults on the server and first client pass, real values after mount.
  const [mode, setModeState] = useState<ZibbyVoiceMode>("ptt");
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    // One-time post-hydration read of localStorage (same pattern as ChatContext's model pick).
    /* eslint-disable react-hooks/set-state-in-effect */
    setModeState(readStoredMode());
    setMutedState(readStoredMuted());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const setMode = useCallback((next: ZibbyVoiceMode) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);
  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    writeStoredMuted(next);
  }, []);

  const [phase, setPhaseState] = useState<Phase>("idle");
  const [finalText, setFinalText] = useState("");
  const [heldInterim, setHeldInterim] = useState("");
  const [hint, setHint] = useState<"tooShort" | null>(null);
  const [error, setError] = useState<ZibbyVoiceError | null>(null);
  const [engineState, setEngineState] = useState<Engine>("speech");
  const [recStream, setRecStream] = useState<MediaStream | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [interruptedId, setInterruptedId] = useState<string | null>(null);

  const session = useRef<Session>({
    phase: "idle",
    engine: "speech",
    startedAt: 0,
    finalText: "",
    lastInterim: "",
    lastActivity: 0,
    hasSpeech: false,
    deferred: false,
    staleFinals: 0,
    flushTimer: undefined,
    silenceTimer: undefined,
    hintTimer: undefined,
  });

  // --- engines ---------------------------------------------------------------------------
  const finishRef = useRef<() => void>(() => undefined);
  const endTalkRef = useRef<(force: boolean) => void>(() => undefined);
  const handleFinal = useCallback((text: string) => {
    const s = session.current;
    if (s.engine === "recorder" && s.staleFinals > 0) {
      s.staleFinals -= 1;
      return;
    }
    if (s.phase === "idle") return;
    const trimmed = text.trim();
    if (!trimmed) return;
    s.finalText = s.finalText ? `${s.finalText} ${trimmed}` : trimmed;
    s.lastInterim = "";
    s.lastActivity = Date.now();
    s.hasSpeech = true;
    setFinalText(s.finalText);
    setHeldInterim("");
    // Web Speech after release: the flush landed — only a short tail is worth waiting for.
    if (s.phase === "finalizing" && s.engine === "speech") {
      clearTimeout(s.flushTimer);
      s.flushTimer = setTimeout(() => finishRef.current(), FLUSH_TAIL_MS);
    }
  }, []);
  const abortRef = useRef<(err: ZibbyVoiceError) => void>(() => undefined);
  const handleError = useCallback((kind: SpeechRecognitionErrorKind) => {
    abortRef.current(kind === "mic-denied" ? "mic-denied" : "unavailable");
  }, []);

  const speech = useSpeechRecognition({ lang, onFinal: handleFinal, onError: handleError });
  const { data: speechStatus, isPending: statusPending } = useSpeechStatusQuery();
  const recorder = useDictationRecorder({
    lang,
    onFinal: handleFinal,
    onError: handleError,
    onStream: setRecStream,
  });
  const useRecorder = speechStatus?.stt.available === true && recorder.supported;
  const supported = useRecorder || speech.supported;
  const ttsAvailable = speechStatus?.reachable !== false;

  const synthesize = useSynthesizeSpeechMutation();
  const { data: config } = useSystemConfigQuery();
  const anyPlaying = useAnyAudioPlaying();

  // Latest values for the stable callbacks below (updated after every commit).
  const latest = useRef({
    enabled,
    mode,
    muted,
    useRecorder,
    statusPending,
    ttsAvailable,
    onUtterance,
    speech,
    recorder,
    synthesize: synthesize.mutateAsync,
    voice: config?.ttsVoice ?? null,
    interim: "",
    level: 0,
    speaking: false,
  });
  const interimNow = useRecorder ? recorder.interim : speech.interim;
  const speakingNow = speakingId !== null || anyPlaying;
  const level = useMicLevel({
    active: phase === "listening",
    stream: useRecorder ? recStream : null,
    openOwn: !useRecorder,
  });
  useEffect(() => {
    latest.current = {
      enabled,
      mode,
      muted,
      useRecorder,
      statusPending,
      ttsAvailable,
      onUtterance,
      speech,
      recorder,
      synthesize: synthesize.mutateAsync,
      voice: config?.ttsVoice ?? null,
      interim: interimNow,
      level,
      speaking: speakingNow,
    };
  });

  // --- session helpers ---------------------------------------------------------------------
  const setPhase = useCallback((next: Phase) => {
    session.current.phase = next;
    setPhaseState(next);
  }, []);

  const clearTimers = useCallback(() => {
    const s = session.current;
    clearTimeout(s.flushTimer);
    clearInterval(s.silenceTimer);
    s.flushTimer = undefined;
    s.silenceTimer = undefined;
  }, []);

  const stopEngine = useCallback(() => {
    const s = session.current;
    const { speech: sp, recorder: rec } = latest.current;
    if (s.engine === "recorder") {
      if (rec.state === "recording") s.staleFinals += 1;
      rec.stop();
    } else {
      sp.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    const s = session.current;
    s.finalText = "";
    s.lastInterim = "";
    setFinalText("");
    setHeldInterim("");
  }, []);

  /** Ends the session and hands the text over (once). */
  const finish = useCallback(() => {
    const s = session.current;
    if (s.phase === "idle") return;
    clearTimers();
    const text = [s.finalText, s.lastInterim].filter(Boolean).join(" ").trim();
    setPhase("idle");
    resetTranscript();
    if (text) latest.current.onUtterance(text);
  }, [clearTimers, resetTranscript, setPhase]);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const abort = useCallback(
    (err: ZibbyVoiceError) => {
      const s = session.current;
      clearTimers();
      if (s.phase !== "idle") stopEngine();
      s.deferred = false;
      setPhase("idle");
      resetTranscript();
      setError(err);
    },
    [clearTimers, resetTranscript, setPhase, stopEngine],
  );
  useEffect(() => {
    abortRef.current = abort;
  }, [abort]);

  const cancelTalk = useCallback(() => {
    const s = session.current;
    if (s.phase === "idle") return;
    clearTimers();
    stopEngine();
    s.deferred = false;
    setPhase("idle");
    resetTranscript();
  }, [clearTimers, resetTranscript, setPhase, stopEngine]);

  const beginEngine = useCallback(() => {
    const s = session.current;
    s.deferred = false;
    if (s.engine === "recorder") latest.current.recorder.start();
    else latest.current.speech.start();
    s.lastActivity = Date.now();
    if (latest.current.mode === "handsfree") {
      s.silenceTimer = setInterval(() => {
        if (s.phase !== "listening") return;
        const { interim, level: lvl } = latest.current;
        const now = Date.now();
        if (lvl > SPEECH_LEVEL || interim !== s.lastInterim) {
          s.lastActivity = now;
          if (lvl > SPEECH_LEVEL || interim) s.hasSpeech = true;
        }
        s.lastInterim = interim;
        if (s.hasSpeech && now - s.lastActivity >= HANDSFREE_SILENCE_MS) endTalkRef.current(true);
      }, SILENCE_TICK_MS);
    }
  }, []);

  // --- TTS ---------------------------------------------------------------------------------
  const speakToken = useRef(0);
  const spokenId = useRef<string | null>(null);
  const speakingIdRef = useRef<string | null>(null);

  const interrupt = useCallback((): string | null => {
    const cut = speakingIdRef.current;
    speakToken.current += 1;
    if (cut !== null || latest.current.speaking) stopAudioPlayback();
    speakingIdRef.current = null;
    setSpeakingId(null);
    if (cut !== null) setInterruptedId(cut);
    return cut;
  }, []);

  const speak = useCallback((messageId: string, text: string) => {
    const L = latest.current;
    if (!L.enabled || L.muted || !L.ttsAvailable) return;
    if (session.current.phase !== "idle") return; // the operator is talking — never speak over
    if (spokenId.current === messageId) return;
    const chunks = chunkForSpeech(toSpeakableText(text));
    if (chunks.length === 0) return;
    spokenId.current = messageId;
    const token = ++speakToken.current;
    setInterruptedId(null);
    speakingIdRef.current = messageId;
    setSpeakingId(messageId);

    const synth = async (chunk: string): Promise<string | null> => {
      const voice = latest.current.voice;
      const res = await latest.current.synthesize({
        body: { text: chunk, ...(voice ? { voice } : {}) },
      });
      return res.status === 200 ? res.body.audioBase64 : null;
    };
    const run = async () => {
      try {
        let next: Promise<string | null> = synth(chunks[0] ?? "");
        for (let i = 0; i < chunks.length; i += 1) {
          const audio = await next;
          if (token !== speakToken.current || !audio) return;
          next = i + 1 < chunks.length ? synth(chunks[i + 1] ?? "") : Promise.resolve(null);
          next.catch(() => undefined);
          const reason = await new Promise<string>((resolve) =>
            playAudioPlayback(`zibby-voice-${messageId}`, audio, resolve),
          );
          if (reason !== "ended" || token !== speakToken.current) return;
        }
      } catch {
        /* the app-wide mutation-error toast already told the operator */
      } finally {
        if (token === speakToken.current) {
          speakingIdRef.current = null;
          setSpeakingId(null);
        }
      }
    };
    void run();
  }, []);

  // --- talking -----------------------------------------------------------------------------
  const endTalk = useCallback(
    (force: boolean) => {
      const s = session.current;
      if (s.phase !== "listening") return;
      const L = latest.current;
      const held = Date.now() - s.startedAt;
      if (held < MIN_HOLD_MS && !force) {
        // Hands-free: the release of the very tap that started it — not an end.
        if (L.mode === "handsfree") return;
        clearTimers();
        stopEngine();
        s.deferred = false;
        setPhase("idle");
        resetTranscript();
        setHint("tooShort");
        clearTimeout(s.hintTimer);
        s.hintTimer = setTimeout(() => setHint(null), HINT_MS);
        return;
      }
      clearTimers();
      s.lastInterim = L.interim || s.lastInterim;
      setHeldInterim(s.lastInterim);
      if (s.deferred) {
        // engine never started (status still unknown) — nothing was recorded
        s.deferred = false;
        finish();
        return;
      }
      setPhase("finalizing");
      if (s.engine === "recorder") {
        const wasRecording = L.recorder.state === "recording";
        L.recorder.stop();
        // wait for the recorder to return to idle (effect below); hard cap as a safety net
        s.flushTimer = setTimeout(() => finishRef.current(), TRANSCRIBE_TIMEOUT_MS);
        if (!wasRecording && L.recorder.state === "idle") finish();
      } else {
        L.speech.stop();
        s.flushTimer = setTimeout(() => finishRef.current(), FLUSH_GRACE_MS);
      }
    },
    [clearTimers, finish, resetTranscript, setPhase, stopEngine],
  );
  useEffect(() => {
    endTalkRef.current = endTalk;
  }, [endTalk]);

  const startTalk = useCallback(() => {
    const s = session.current;
    const L = latest.current;
    if (!L.enabled) return;
    if (s.phase === "listening") {
      if (L.mode === "handsfree") endTalk(true); // second start = manual end
      return;
    }
    if (s.phase === "finalizing") return;
    if (L.speaking || speakingIdRef.current !== null) interrupt();
    if (!L.useRecorder && !L.speech.supported) {
      setError("unavailable");
      return;
    }
    setError(null);
    setHint(null);
    clearTimeout(s.hintTimer);
    resetTranscript();
    s.engine = L.useRecorder ? "recorder" : "speech";
    setEngineState(s.engine);
    s.startedAt = Date.now();
    s.hasSpeech = false;
    s.lastActivity = s.startedAt;
    setPhase("listening");
    if (L.statusPending) {
      s.deferred = true; // engine choice depends on /speech/status — start once it is known
      return;
    }
    beginEngine();
  }, [beginEngine, endTalk, interrupt, resetTranscript, setPhase]);

  const stopTalk = useCallback(() => endTalk(false), [endTalk]);
  const pressTalk = useCallback(() => startTalk(), [startTalk]);
  const releaseTalk = useCallback(() => {
    if (latest.current.mode === "ptt") endTalk(false);
  }, [endTalk]);

  // Deferred start: the status arrived.
  useEffect(() => {
    const s = session.current;
    if (statusPending || !s.deferred || s.phase !== "listening") return;
    s.engine = useRecorder ? "recorder" : "speech";

    setEngineState(s.engine);
    beginEngine();
  }, [statusPending, useRecorder, beginEngine]);

  // Recorder path: transcription done (recorder back to idle) → deliver.
  useEffect(() => {
    const s = session.current;
    if (recorder.state === "idle") {
      s.staleFinals = 0;
      if (s.phase === "finalizing" && s.engine === "recorder") finish();
    }
  }, [recorder.state, finish]);

  // Echo guard: Zibby started speaking while the mic was live (manual read-aloud) → mic off.
  useEffect(() => {
    if (speakingNow && session.current.phase !== "idle") cancelTalk();
  }, [speakingNow, cancelTalk]);

  // Teardown when the overlay closes.
  useEffect(() => {
    if (enabled) return;
    cancelTalk();
    if (speakingIdRef.current !== null) interrupt();
    spokenId.current = null;
    clearTimeout(session.current.hintTimer);
    // Closing the overlay is the teardown event: a leftover hint/error must not greet the next open.

    /* eslint-disable react-hooks/set-state-in-effect */
    setHint(null);
    setError(null);
    setInterruptedId(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [enabled, cancelTalk, interrupt]);

  // Unmount: release everything.
  useEffect(() => {
    const s = session.current;
    return () => {
      clearTimeout(s.flushTimer);
      clearInterval(s.silenceTimer);
      clearTimeout(s.hintTimer);
      speakToken.current += 1;
      if (speakingIdRef.current !== null) stopAudioPlayback();
    };
  }, []);

  const listening = phase === "listening";
  return {
    supported,
    mode,
    setMode,
    listening,
    transcript: {
      final: phase === "idle" ? "" : finalText,
      interim: phase === "idle" ? "" : interimNow || heldInterim,
    },
    transcribing: phase === "finalizing" && engineState === "recorder",
    level: listening ? level : 0,
    hint,
    startTalk,
    stopTalk,
    cancelTalk,
    pressTalk,
    releaseTalk,
    muted,
    setMuted,
    speaking: speakingNow,
    speakingId,
    speakLevel: 0,
    interruptedId,
    speak,
    interrupt,
    error,
  };
}
