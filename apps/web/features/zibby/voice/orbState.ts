import type { ZibbyOrbState } from "@zibby/design-system";

export type { ZibbyOrbState };

/** Lifecycle of the overlay itself (mirrors the design's `zp`: closed → summoning → open → leaving). */
export type ZibbyOverlayPhase = "closed" | "summoning" | "open" | "leaving";

/** The slice of a live tool event the orb cares about (structurally a `ChatToolEvent`). */
export interface OrbToolEvent {
  name: string;
  status?: "started" | "ok" | "error";
}

export interface DeriveOrbStateInput {
  phase: ZibbyOverlayPhase;
  /** The microphone is live (PTT held / hands-free listening). */
  listening: boolean;
  /** A turn is in flight (sent, no terminal `done`/`error` yet). */
  thinking: boolean;
  /** The latest live tool event of the in-flight turn, or `null`. */
  lastToolEvent: OrbToolEvent | null;
  /** Reply text is arriving (the assistant message is streaming). */
  streamingText: boolean;
  /** TTS of a reply is playing. */
  speaking: boolean;
  /** The last reply carries something awaiting the operator (approvals card, ...). */
  needsDecision: boolean;
  /** Transient (~1.5 s), held by the container after an action completed. */
  justDone: boolean;
  /** Transient (~1.5 s), held by the container after an error / rejection. */
  justErrored: boolean;
  /** Offline, limit reached, or microphone muted-and-unavailable. */
  paused: boolean;
  /** Files are being dragged over the app (the drop zone is "listening"). */
  dragging: boolean;
  /**
   * Voice replies are on (not muted, TTS available). Optional, default `false`. It decides
   * what streaming reply text means: with voice on the reply is being spoken as it arrives
   * (`speak`); with voice off the operator is just reading, so the orb stays on `think`
   * until the turn ends (there is no "reading" state).
   */
  voiceOn?: boolean;
}

/** Tool names (after stripping an `mcp__<server>__` prefix) that only READ data. */
const READ_TOOL_EXACT = new Set([
  "recall_memory",
  "get_status",
  "show_widget",
  "api_list_operations",
  "api_describe_operation",
]);
const READ_TOOL_PREFIXES = [
  "get_",
  "list_",
  "read_",
  "search_",
  "find_",
  "recall_",
  "describe_",
  "show_",
  "api_list_",
  "api_describe_",
  "slack_read",
  "slack_get",
  "slack_list",
  "slack_search",
  "slack_history",
];

/** `mcp__zibby__create_task` → `create_task`. */
function bareToolName(name: string): string {
  const idx = name.lastIndexOf("__");
  return (idx >= 0 ? name.slice(idx + 2) : name).toLowerCase();
}

/** `search` for read-type tools, `work` for everything else (actions, agents, machine/open tools). */
export function classifyTool(name: string): "search" | "work" {
  const bare = bareToolName(name);
  if (READ_TOOL_EXACT.has(bare)) return "search";
  return READ_TOOL_PREFIXES.some((p) => bare.startsWith(p)) ? "search" : "work";
}

/**
 * Maps the conversation situation to the orb's 12 states (spec section 3, "Stav orbu").
 * A pure function: every input is explicit.
 *
 * Priority, highest first — the first matching rule wins:
 *
 * 1. `phase` closed → `sleep`; summoning / leaving → `wake` (the overlay's own animation
 *    owns the orb; nothing else can show through).
 * 2. `justErrored` → `error` (transient, always visible).
 * 3. `listening` or `dragging` → `listen` (the operator is addressing Zibby right now).
 * 4. `speaking`, or reply text streaming while `voiceOn` → `speak`.
 * 5. `paused` → `paused` (offline / limit: nothing in flight can progress, so a grey orb
 *    is the honest state; it still yields to the operator's own listening and to speech).
 * 6. In flight (`thinking` or `streamingText`): streaming reply text with voice off →
 *    `think`; otherwise the latest tool event decides — read-type → `search`, action-type
 *    → `work`; no tool event → `think`.
 * 7. `needsDecision` → `needs` (a fresh turn in flight beats an older pending card).
 * 8. `justDone` → `done` (transient; a pending decision keeps `needs`).
 * 9. otherwise → `ready`.
 */
export function deriveOrbState(input: DeriveOrbStateInput): ZibbyOrbState {
  if (input.phase === "closed") return "sleep";
  if (input.phase === "summoning" || input.phase === "leaving") return "wake";
  if (input.justErrored) return "error";
  if (input.listening || input.dragging) return "listen";
  if (input.speaking || (input.streamingText && input.voiceOn === true)) return "speak";
  if (input.paused) return "paused";
  if (input.thinking || input.streamingText) {
    if (input.streamingText) return "think";
    return input.lastToolEvent ? classifyTool(input.lastToolEvent.name) : "think";
  }
  if (input.needsDecision) return "needs";
  if (input.justDone) return "done";
  return "ready";
}

/** next-intl namespace holding every string of the voice layer. */
export const ZIBBY_VOICE_NAMESPACE = "zibbyVoice";

/** Status-line i18n key (relative to {@link ZIBBY_VOICE_NAMESPACE}) per orb state. */
export const ORB_STATE_LABEL_KEYS = {
  sleep: "status.sleep",
  ready: "status.ready",
  wake: "status.wake",
  listen: "status.listen",
  think: "status.think",
  search: "status.search",
  work: "status.work",
  speak: "status.speak",
  needs: "status.needs",
  done: "status.done",
  error: "status.error",
  paused: "status.paused",
} as const satisfies Record<ZibbyOrbState, string>;

export type OrbStateLabelKey = (typeof ORB_STATE_LABEL_KEYS)[ZibbyOrbState];

/** Label key shown while files are dragged over (the orb is `listen`, the line differs). */
export const DROP_LABEL_KEY = "status.drop";

/** The i18n key of the status line for an orb state. */
export function orbStateLabelKey(state: ZibbyOrbState): OrbStateLabelKey {
  return ORB_STATE_LABEL_KEYS[state];
}

/** i18n keys (relative to {@link ZIBBY_VOICE_NAMESPACE}) of the voice hint / error messages. */
export const ZIBBY_VOICE_MESSAGE_KEYS = {
  tooShort: "hint.tooShort",
  "mic-denied": "error.micDenied",
  unavailable: "error.unavailable",
} as const;
