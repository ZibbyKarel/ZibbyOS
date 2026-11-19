import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLUSH_GRACE_MS,
  HANDSFREE_SILENCE_MS,
  HINT_MS,
  type ZibbyVoiceOptions,
  useZibbyVoice,
} from "./useZibbyVoice";
import { ZIBBY_VOICE_MODE_KEY, ZIBBY_VOICE_MUTED_KEY } from "./voicePrefs";

interface EngineOpts {
  onFinal: (text: string) => void;
  onError: (kind: "mic-denied" | "unsupported" | "network" | "aborted") => void;
}
const speech = vi.hoisted(() => ({
  supported: true,
  listening: false,
  interim: "",
  start: vi.fn(),
  stop: vi.fn(),
}));
const recorder = vi.hoisted(() => ({
  supported: true,
  state: "idle" as "idle" | "recording" | "transcribing",
  interim: "",
  start: vi.fn(),
  stop: vi.fn(),
}));
const opts = vi.hoisted(() => ({
  speech: null as EngineOpts | null,
  recorder: null as EngineOpts | null,
}));
const status = vi.hoisted(() => ({
  pending: false,
  data: { stt: { available: false }, reachable: true } as {
    stt: { available: boolean };
    reachable: boolean;
  },
}));
const audio = vi.hoisted(() => ({
  playing: false,
  settle: null as ((reason: string) => void) | null,
  play: vi.fn(),
  stop: vi.fn(),
}));
const synth = vi.hoisted(() => vi.fn());
const mic = vi.hoisted(() => ({ level: 0 }));

vi.mock("next-intl", () => ({ useLocale: () => "cs" }));
vi.mock("../../chat/hooks/useVoiceMode", () => ({ localeToLang: () => "cs-CZ" }));
vi.mock("../../chat/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: (o: EngineOpts) => {
    opts.speech = o;
    return speech;
  },
}));
vi.mock("../../chat/hooks/useDictationRecorder", () => ({
  useDictationRecorder: (o: EngineOpts) => {
    opts.recorder = o;
    return recorder;
  },
}));
vi.mock("../../chat/hooks/useAudioPlayback", () => ({
  playAudioPlayback: (key: string, data: string, cb: (r: string) => void) => {
    audio.settle = cb;
    audio.play(key, data);
  },
  stopAudioPlayback: () => audio.stop(),
  useAnyAudioPlaying: () => audio.playing,
}));
vi.mock("../../chat/mutations/useSynthesizeSpeechMutation", () => ({
  useSynthesizeSpeechMutation: () => ({ mutateAsync: synth }),
}));
vi.mock("../../chat/queries", () => ({
  useSpeechStatusQuery: () => ({
    data: status.pending ? undefined : status.data,
    isPending: status.pending,
  }),
}));
vi.mock("../../system", () => ({ useSystemConfigQuery: () => ({ data: { ttsVoice: null } }) }));
vi.mock("./useMicLevel", () => ({ useMicLevel: () => mic.level }));

function setup(initial: Partial<ZibbyVoiceOptions> = {}) {
  const onUtterance = vi.fn();
  const hook = renderHook((p: { enabled: boolean }) => useZibbyVoice({ onUtterance, ...p }), {
    initialProps: { enabled: initial.enabled ?? true },
  });
  return { onUtterance, ...hook };
}
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  speech.supported = true;
  speech.listening = false;
  speech.interim = "";
  speech.start.mockReset();
  speech.stop.mockReset();
  recorder.supported = true;
  recorder.state = "idle";
  recorder.interim = "";
  recorder.start.mockReset();
  recorder.stop.mockReset();
  status.pending = false;
  status.data = { stt: { available: false }, reachable: true };
  audio.playing = false;
  audio.settle = null;
  audio.play.mockReset();
  audio.stop.mockReset();
  synth.mockReset();
  synth.mockResolvedValue({ status: 200, body: { audioBase64: "AAAA" } });
  mic.level = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useZibbyVoice — push to talk (Web Speech path)", () => {
  it("sends once on release, after the flush grace", async () => {
    const { result, onUtterance } = setup();
    act(() => result.current.startTalk());
    expect(speech.start).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(true);
    await tick(1000);
    act(() => opts.speech?.onFinal("ahoj"));
    expect(result.current.transcript.final).toBe("ahoj");
    act(() => result.current.stopTalk());
    expect(speech.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
    expect(onUtterance).not.toHaveBeenCalled();
    act(() => opts.speech?.onFinal("světe"));
    await tick(FLUSH_GRACE_MS);
    expect(onUtterance).toHaveBeenCalledTimes(1);
    expect(onUtterance).toHaveBeenCalledWith("ahoj světe");
    expect(result.current.transcript).toEqual({ final: "", interim: "" });
  });

  it("falls back to the interim tail when no final arrives", async () => {
    const { result, onUtterance, rerender } = setup();
    act(() => result.current.startTalk());
    speech.interim = "polovina věty";
    rerender({ enabled: true });
    await tick(1000);
    act(() => result.current.stopTalk());
    speech.interim = "";
    rerender({ enabled: true });
    await tick(FLUSH_GRACE_MS);
    expect(onUtterance).toHaveBeenCalledWith("polovina věty");
  });

  it("a hold under 300 ms shows the hint and sends nothing", async () => {
    const { result, onUtterance } = setup();
    act(() => result.current.startTalk());
    await tick(100);
    act(() => opts.speech?.onFinal("ťuk"));
    act(() => result.current.stopTalk());
    expect(result.current.hint).toBe("tooShort");
    expect(speech.stop).toHaveBeenCalled();
    await tick(FLUSH_GRACE_MS * 2);
    expect(onUtterance).not.toHaveBeenCalled();
    await tick(HINT_MS);
    expect(result.current.hint).toBeNull();
  });

  it("the hint clears on the next start", async () => {
    const { result } = setup();
    act(() => result.current.startTalk());
    await tick(50);
    act(() => result.current.stopTalk());
    expect(result.current.hint).toBe("tooShort");
    act(() => result.current.startTalk());
    expect(result.current.hint).toBeNull();
  });

  it("an empty transcript sends nothing", async () => {
    const { result, onUtterance } = setup();
    act(() => result.current.startTalk());
    await tick(1000);
    act(() => result.current.stopTalk());
    await tick(FLUSH_GRACE_MS);
    expect(onUtterance).not.toHaveBeenCalled();
    expect(result.current.hint).toBeNull();
  });

  it("cancelTalk aborts without sending, late finals are ignored", async () => {
    const { result, onUtterance } = setup();
    act(() => result.current.startTalk());
    await tick(1000);
    act(() => opts.speech?.onFinal("zrušit"));
    act(() => result.current.cancelTalk());
    act(() => opts.speech?.onFinal("pozdě"));
    await tick(2000);
    expect(onUtterance).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it("maps recognition errors", () => {
    const { result } = setup();
    act(() => result.current.startTalk());
    act(() => opts.speech?.onError("mic-denied"));
    expect(result.current.error).toBe("mic-denied");
    expect(result.current.listening).toBe(false);
    act(() => result.current.startTalk());
    expect(result.current.error).toBeNull();
    act(() => opts.speech?.onError("network"));
    expect(result.current.error).toBe("unavailable");
  });

  it("reports unavailable when no STT path exists", () => {
    speech.supported = false;
    recorder.supported = false;
    const { result } = setup();
    expect(result.current.supported).toBe(false);
    act(() => result.current.startTalk());
    expect(result.current.error).toBe("unavailable");
    expect(speech.start).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const { result } = setup({ enabled: false });
    act(() => result.current.startTalk());
    expect(speech.start).not.toHaveBeenCalled();
  });
});

describe("useZibbyVoice — hands-free", () => {
  it("ends after ~0.8 s of silence following speech and sends", async () => {
    const { result, onUtterance, rerender } = setup();
    act(() => result.current.setMode("handsfree"));
    act(() => result.current.startTalk());
    await tick(500); // silence before any speech does not end it
    expect(result.current.listening).toBe(true);
    speech.interim = "ahoj";
    rerender({ enabled: true });
    await tick(200);
    act(() => opts.speech?.onFinal("ahoj zibby"));
    speech.interim = "";
    rerender({ enabled: true });
    await tick(HANDSFREE_SILENCE_MS - 200);
    expect(result.current.listening).toBe(true);
    await tick(400);
    expect(result.current.listening).toBe(false);
    await tick(FLUSH_GRACE_MS);
    expect(onUtterance).toHaveBeenCalledTimes(1);
    expect(onUtterance).toHaveBeenCalledWith("ahoj zibby");
  });

  it("uses the mic level as speech activity", async () => {
    const { result, onUtterance, rerender } = setup();
    act(() => result.current.setMode("handsfree"));
    act(() => result.current.startTalk());
    mic.level = 0.5;
    rerender({ enabled: true });
    await tick(300);
    act(() => opts.speech?.onFinal("rychle"));
    mic.level = 0;
    rerender({ enabled: true });
    await tick(HANDSFREE_SILENCE_MS + 200 + FLUSH_GRACE_MS);
    expect(onUtterance).toHaveBeenCalledWith("rychle");
  });

  it("a second startTalk ends it manually; the release of the starting tap does not", async () => {
    const { result, onUtterance } = setup();
    act(() => result.current.setMode("handsfree"));
    act(() => result.current.pressTalk());
    await tick(80);
    act(() => result.current.releaseTalk());
    act(() => result.current.stopTalk()); // < 300 ms: the tap's own release
    expect(result.current.listening).toBe(true);
    await tick(1000);
    act(() => opts.speech?.onFinal("dlouhé diktování"));
    act(() => result.current.pressTalk());
    expect(result.current.listening).toBe(false);
    await tick(FLUSH_GRACE_MS);
    expect(onUtterance).toHaveBeenCalledWith("dlouhé diktování");
  });
});

describe("useZibbyVoice — recorder path", () => {
  beforeEach(() => {
    status.data = { stt: { available: true }, reachable: true };
  });

  it("waits for the server transcript and sends it once", async () => {
    const { result, onUtterance, rerender } = setup();
    act(() => result.current.startTalk());
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(speech.start).not.toHaveBeenCalled();
    recorder.state = "recording";
    rerender({ enabled: true });
    await tick(1000);
    act(() => result.current.stopTalk());
    expect(recorder.stop).toHaveBeenCalled();
    recorder.state = "transcribing";
    rerender({ enabled: true });
    expect(result.current.transcribing).toBe(true);
    expect(onUtterance).not.toHaveBeenCalled();
    act(() => opts.recorder?.onFinal("přepis ze serveru"));
    recorder.state = "idle";
    rerender({ enabled: true });
    expect(onUtterance).toHaveBeenCalledTimes(1);
    expect(onUtterance).toHaveBeenCalledWith("přepis ze serveru");
    expect(result.current.transcribing).toBe(false);
  });

  it("an empty clip sends nothing", async () => {
    const { result, onUtterance, rerender } = setup();
    act(() => result.current.startTalk());
    recorder.state = "recording";
    rerender({ enabled: true });
    await tick(1000);
    act(() => result.current.stopTalk());
    recorder.state = "idle";
    rerender({ enabled: true });
    expect(onUtterance).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it("defers the engine start until /speech/status is known", () => {
    status.pending = true;
    const { result, rerender } = setup();
    act(() => result.current.startTalk());
    expect(recorder.start).not.toHaveBeenCalled();
    expect(speech.start).not.toHaveBeenCalled();
    status.pending = false;
    rerender({ enabled: true });
    expect(recorder.start).toHaveBeenCalledTimes(1);
  });
});

describe("useZibbyVoice — speaking and the echo guard", () => {
  it("speak reads the reply and clears speaking when playback ends", async () => {
    const { result, rerender } = setup();
    act(() => result.current.speak("m1", "**Ahoj** světe. Hotovo."));
    expect(result.current.speaking).toBe(true);
    expect(result.current.speakingId).toBe("m1");
    await tick(0);
    expect(synth).toHaveBeenCalledWith({ body: { text: "Ahoj světe. Hotovo." } });
    expect(audio.play).toHaveBeenCalledWith("zibby-voice-m1", "AAAA");
    audio.playing = true;
    rerender({ enabled: true });
    await act(async () => audio.settle?.("ended"));
    audio.playing = false;
    rerender({ enabled: true });
    expect(result.current.speaking).toBe(false);
    expect(result.current.interruptedId).toBeNull();
  });

  it("startTalk while speaking interrupts first, then listens", async () => {
    const { result } = setup();
    act(() => result.current.speak("m1", "Dlouhá odpověď."));
    await tick(0);
    act(() => result.current.startTalk());
    expect(audio.stop).toHaveBeenCalledTimes(1);
    expect(result.current.interruptedId).toBe("m1");
    expect(result.current.speaking).toBe(false);
    expect(speech.start).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(true);
    await act(async () => audio.settle?.("stopped"));
    expect(audio.play).toHaveBeenCalledTimes(1); // the queue did not continue
  });

  it("interrupt returns the cut reply id", async () => {
    const { result } = setup();
    expect(result.current.interrupt()).toBeNull();
    act(() => result.current.speak("m2", "Něco."));
    await tick(0);
    let cut: string | null = null;
    act(() => {
      cut = result.current.interrupt();
    });
    expect(cut).toBe("m2");
  });

  it("muted: speak is a no-op", async () => {
    const { result } = setup();
    act(() => result.current.setMuted(true));
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    expect(synth).not.toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it("TTS unreachable: speak is a no-op", async () => {
    status.data = { stt: { available: false }, reachable: false };
    const { result } = setup();
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    expect(synth).not.toHaveBeenCalled();
  });

  it("TTS unreachable and no browser voice: ttsAvailable is false, speak is a no-op", async () => {
    status.data = { stt: { available: false }, reachable: false };
    const { result } = setup();
    expect(result.current.ttsAvailable).toBe(false);
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    expect(synth).not.toHaveBeenCalled();
  });

  it("TTS unreachable: reads the reply with the browser voice (Czech) instead", async () => {
    status.data = { stt: { available: false }, reachable: false };
    const spoken: { text: string; lang: string; voice: unknown }[] = [];
    const cs = { lang: "cs-CZ", name: "Zuzana" };
    class FakeUtterance {
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      voice: unknown = null;
      lang = "";
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "en-US", name: "Sam" }, cs],
        speak: (u: FakeUtterance) => {
          spoken.push({ text: u.text, lang: u.lang, voice: u.voice });
          u.onend?.();
        },
        cancel: vi.fn(),
      },
    });
    try {
      const { result } = setup();
      expect(result.current.ttsAvailable).toBe(true);
      act(() => result.current.speak("m1", "Ahoj."));
      await tick(0);
      expect(synth).not.toHaveBeenCalled();
      expect(spoken).toEqual([{ text: "Ahoj.", lang: "cs-CZ", voice: cs }]);
    } finally {
      Reflect.deleteProperty(window, "speechSynthesis");
      vi.unstubAllGlobals();
    }
  });

  it("does not speak over the operator", async () => {
    const { result } = setup();
    act(() => result.current.startTalk());
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    expect(synth).not.toHaveBeenCalled();
  });

  it("a read-aloud starting mid-listen switches the mic off", () => {
    const { result, rerender } = setup();
    act(() => result.current.startTalk());
    audio.playing = true;
    rerender({ enabled: true });
    expect(result.current.listening).toBe(false);
    expect(speech.stop).toHaveBeenCalled();
  });

  it("a long reply is read in sentence chunks, in order", async () => {
    const { result } = setup();
    const sentence = "Tohle je docela dlouhá věta, která zabere místo v bloku. ";
    act(() => result.current.speak("m1", sentence.repeat(12)));
    await tick(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await act(async () => audio.settle?.("ended"));
    await tick(0);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(synth.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("useZibbyVoice — teardown and persistence", () => {
  it("enabled=false releases the mic and stops playback", async () => {
    const { result, rerender } = setup();
    act(() => result.current.startTalk());
    rerender({ enabled: false });
    expect(speech.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);

    rerender({ enabled: true });
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    rerender({ enabled: false });
    expect(audio.stop).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it("unmounting while speaking stops playback", async () => {
    const { result, unmount } = setup();
    act(() => result.current.speak("m1", "Ahoj."));
    await tick(0);
    unmount();
    expect(audio.stop).toHaveBeenCalled();
  });

  it("persists mode and muted and hydrates them after mount", () => {
    const first = setup();
    expect(first.result.current.mode).toBe("ptt");
    expect(first.result.current.muted).toBe(false);
    act(() => first.result.current.setMode("handsfree"));
    act(() => first.result.current.setMuted(true));
    expect(window.localStorage.getItem(ZIBBY_VOICE_MODE_KEY)).toBe("handsfree");
    expect(window.localStorage.getItem(ZIBBY_VOICE_MUTED_KEY)).toBe("true");
    first.unmount();

    const second = setup();
    expect(second.result.current.mode).toBe("handsfree");
    expect(second.result.current.muted).toBe(true);
  });

  it("survives throwing storage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = setup();
    expect(result.current.mode).toBe("ptt");
    spy.mockRestore();
  });
});
