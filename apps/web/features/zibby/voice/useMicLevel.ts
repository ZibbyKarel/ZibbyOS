"use client";

import { useEffect, useState } from "react";

export interface UseMicLevelOptions {
  /** Meter runs only while `true`; everything is released the moment it turns false. */
  active: boolean;
  /** An already-open mic stream to analyse (e.g. the dictation recorder's). Never stopped here. */
  stream?: MediaStream | null;
  /** When no `stream` is given, open (and later release) our own `getUserMedia` stream. */
  openOwn?: boolean;
}

/** Sampling period of the meter. */
const TICK_MS = 50;
/** RMS of ~0.2 is loud speech close to a laptop mic. */
const GAIN = 5;
const ATTACK = 0.6;
const RELEASE = 0.15;
/** Skip re-renders for sub-perceptual changes. */
const MIN_DELTA = 0.02;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Live mic level 0–1 (RMS of an `AnalyserNode`, smoothed: fast attack, slow release).
 * The AudioContext (and, when we opened it, the stream) exists only while `active`;
 * cleanup stops tracks and closes the context. Any failure (denied, no Web Audio)
 * degrades silently to `0`.
 */
export function useMicLevel({ active, stream, openOwn = false }: UseMicLevelOptions): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!active) return;
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    let cancelled = false;
    let ownStream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    const attach = (media: MediaStream) => {
      try {
        ctx = new Ctor();
        void ctx.resume?.();
        source = ctx.createMediaStreamSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let smooth = 0;
        let shown = 0;
        timer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const raw = Math.min(1, Math.sqrt(sum / buf.length) * GAIN);
          smooth += (raw - smooth) * (raw > smooth ? ATTACK : RELEASE);
          if (Math.abs(smooth - shown) >= MIN_DELTA || (smooth < MIN_DELTA && shown !== 0)) {
            shown = smooth < MIN_DELTA ? 0 : smooth;
            setLevel(shown);
          }
        }, TICK_MS);
      } catch {
        /* no analyser — level stays 0 */
      }
    };

    if (stream) {
      attach(stream);
    } else if (
      openOwn &&
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia
    ) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((media) => {
          if (cancelled) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          ownStream = media;
          attach(media);
        })
        .catch(() => {
          /* denied / no device — degrade to 0 */
        });
    }

    return () => {
      cancelled = true;
      if (timer !== undefined) clearInterval(timer);
      try {
        source?.disconnect();
      } catch {
        /* already disconnected */
      }
      void ctx?.close?.().catch(() => undefined);
      ownStream?.getTracks().forEach((t) => t.stop());
      setLevel(0);
    };
  }, [active, stream, openOwn]);

  return active ? level : 0;
}
