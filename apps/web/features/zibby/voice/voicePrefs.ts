export type ZibbyVoiceMode = "ptt" | "handsfree";

export const ZIBBY_VOICE_MODE_KEY = "zibby.voice.mode";
export const ZIBBY_VOICE_MUTED_KEY = "zibby.voice.muted";

/** SSR-guarded read; storage that throws (private window) yields `null`. */
function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — preference lasts for the session only */
  }
}

export function readStoredMode(): ZibbyVoiceMode {
  return read(ZIBBY_VOICE_MODE_KEY) === "handsfree" ? "handsfree" : "ptt";
}
export function writeStoredMode(mode: ZibbyVoiceMode): void {
  write(ZIBBY_VOICE_MODE_KEY, mode);
}
export function readStoredMuted(): boolean {
  return read(ZIBBY_VOICE_MUTED_KEY) === "true";
}
export function writeStoredMuted(muted: boolean): void {
  write(ZIBBY_VOICE_MUTED_KEY, String(muted));
}
