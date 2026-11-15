/**
 * Pure logic for Zibby's configurable global summon shortcut. No React, no DOM
 * access (the platform helper takes an injectable navigator) so every branch is
 * unit-testable. Keys are identified by `KeyboardEvent.code` (layout-independent,
 * and the only reliable signal on macOS where Option+Space yields a no-break
 * space as `key`).
 */

export interface ZibbyShortcut {
  /** `KeyboardEvent.code`, e.g. `"Space"`, `"KeyK"`, `"F6"`. */
  code: string;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/** The subset of `KeyboardEvent` the logic reads (so tests need no DOM events). */
export interface ShortcutEventLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type ShortcutPlatform = "mac" | "windows" | "linux";

export const DEFAULT_ZIBBY_SHORTCUT: ZibbyShortcut = {
  code: "Space",
  alt: true,
  ctrl: false,
  meta: false,
  shift: false,
};

/** Extra combination that also summons Zibby on non-macOS while the default is stored. */
export const DEFAULT_ZIBBY_SHORTCUT_ALIAS: ZibbyShortcut = {
  code: "Space",
  alt: false,
  ctrl: true,
  meta: false,
  shift: false,
};

// ── Platform ────────────────────────────────────────────────────────────

export interface NavigatorLike {
  platform?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * SSR-safe platform detection. With no navigator (server) it falls back to
 * `"linux"`; callers that render platform-specific text should read it through
 * `useShortcutPlatform` so hydration stays consistent.
 */
export function detectShortcutPlatform(
  nav: NavigatorLike | undefined = typeof navigator === "undefined" ? undefined : navigator,
): ShortcutPlatform {
  if (!nav) return "linux";
  const hint = `${nav.platform ?? ""} ${nav.userAgent ?? ""}`;
  // iPadOS/iOS report "Mac"-ish platforms or "iPhone"; all use ⌘/⌥ glyphs.
  if (/mac|iphone|ipad|ipod/i.test(hint)) return "mac";
  if (/win/i.test(hint)) return "windows";
  return "linux";
}

// ── Matching ────────────────────────────────────────────────────────────

export function shortcutsEqual(a: ZibbyShortcut, b: ZibbyShortcut): boolean {
  return (
    a.code === b.code &&
    a.alt === b.alt &&
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.shift === b.shift
  );
}

/** Exact match: same `code` and exactly the same set of modifiers. */
export function matchesShortcut(event: ShortcutEventLike, shortcut: ZibbyShortcut): boolean {
  return (
    event.code === shortcut.code &&
    event.altKey === shortcut.alt &&
    event.ctrlKey === shortcut.ctrl &&
    event.metaKey === shortcut.meta &&
    event.shiftKey === shortcut.shift
  );
}

/**
 * The shortcut that summons Zibby: `shortcut` itself, plus — only while the stored
 * shortcut is still the default AND the platform is not macOS — Ctrl+Space
 * (Alt+Space is the window menu on Windows and most Linux desktops).
 */
export function matchesZibbyShortcut(
  event: ShortcutEventLike,
  shortcut: ZibbyShortcut,
  platform: ShortcutPlatform,
): boolean {
  if (matchesShortcut(event, shortcut)) return true;
  return (
    platform !== "mac" &&
    shortcutsEqual(shortcut, DEFAULT_ZIBBY_SHORTCUT) &&
    matchesShortcut(event, DEFAULT_ZIBBY_SHORTCUT_ALIAS)
  );
}

// ── Capture / validation ────────────────────────────────────────────────

const MODIFIER_CODE = /^(Alt|Control|Meta|Shift|OS)(Left|Right)?$/;
const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;
const CODE_SHAPE = /^[A-Za-z][A-Za-z0-9]*$/;

/** True for `AltLeft`, `ControlRight`, `MetaLeft`, `ShiftLeft`, … */
export function isModifierCode(code: string): boolean {
  return MODIFIER_CODE.test(code);
}

/**
 * A shortcut is acceptable as a *global* summon key only when it cannot hijack
 * normal typing: a real (non-modifier) key AND (Alt, Ctrl or Meta held, or a
 * function key). Shift alone does not count — Shift+letter is just a capital.
 */
function isAcceptable(shortcut: ZibbyShortcut): boolean {
  if (!CODE_SHAPE.test(shortcut.code) || isModifierCode(shortcut.code)) return false;
  return shortcut.alt || shortcut.ctrl || shortcut.meta || FUNCTION_KEY.test(shortcut.code);
}

/** Builds a shortcut from a key press, or `null` for modifier-only / unsafe presses. */
export function shortcutFromEvent(event: ShortcutEventLike): ZibbyShortcut | null {
  const shortcut: ZibbyShortcut = {
    code: event.code,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
  return isAcceptable(shortcut) ? shortcut : null;
}

// ── Serialization ───────────────────────────────────────────────────────

/** Canonical order: Ctrl, Alt, Shift, Meta, then the key code — e.g. `"Alt+Space"`. */
export function serializeShortcut(shortcut: ZibbyShortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.meta) parts.push("Meta");
  parts.push(shortcut.code);
  return parts.join("+");
}

/** Tolerant inverse of {@link serializeShortcut}: anything invalid yields `null`. */
export function parseShortcut(raw: unknown): ZibbyShortcut | null {
  if (typeof raw !== "string") return null;
  const parts = raw
    .trim()
    .split("+")
    .map((p) => p.trim());
  const code = parts.pop();
  if (!code) return null;
  const shortcut: ZibbyShortcut = { code, alt: false, ctrl: false, meta: false, shift: false };
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "ctrl":
      case "control":
        shortcut.ctrl = true;
        break;
      case "alt":
      case "option":
        shortcut.alt = true;
        break;
      case "shift":
        shortcut.shift = true;
        break;
      case "meta":
      case "cmd":
      case "command":
        shortcut.meta = true;
        break;
      default:
        return null;
    }
  }
  return isAcceptable(shortcut) ? shortcut : null;
}

// ── Display ─────────────────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "Del",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  PageUp: "PgUp",
  PageDown: "PgDn",
};

function keyLabel(code: string): string {
  const known = KEY_LABELS[code];
  if (known) return known;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter?.[1]) return letter[1];
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit?.[1]) return code.startsWith("Numpad") ? `Num ${digit[1]}` : digit[1];
  return code;
}

/** Display tokens, one per `Kbd`: `["⌥", "Space"]` on macOS, `["Alt", "Space"]` elsewhere. */
export function formatShortcut(shortcut: ZibbyShortcut, platform: ShortcutPlatform): string[] {
  const mac = platform === "mac";
  const tokens: string[] = [];
  if (shortcut.ctrl) tokens.push(mac ? "⌃" : "Ctrl");
  if (shortcut.alt) tokens.push(mac ? "⌥" : "Alt");
  if (shortcut.shift) tokens.push(mac ? "⇧" : "Shift");
  if (shortcut.meta) tokens.push(mac ? "⌘" : platform === "windows" ? "Win" : "Super");
  tokens.push(keyLabel(shortcut.code));
  return tokens;
}

// ── Collisions ──────────────────────────────────────────────────────────

/**
 * Ids of well-known system / browser / app combinations. Each maps to an i18n key
 * `zibbyShortcut.collision.<id>`. The UI warns but still allows saving.
 */
export type ShortcutCollisionId =
  | "spotlight"
  | "inputSourceMac"
  | "inputSourceSuper"
  | "windowMenu"
  | "altTab"
  | "closeWindow"
  | "quitApp"
  | "browserCloseTab"
  | "browserNewTab"
  | "browserNewWindow"
  | "browserReload"
  | "browserLocation"
  | "browserPrint"
  | "browserFind"
  | "browserSave"
  | "browserTabSwitch"
  | "browserTabSelect"
  | "browserBackForward"
  | "browserEditing"
  | "browserHelp"
  | "browserFullscreen"
  | "browserDevtools"
  | "commandPalette"
  | "newTask";

interface CollisionRule {
  id: ShortcutCollisionId;
  codes: readonly string[];
  /** Restrict to these platforms (default: all). */
  platforms?: readonly ShortcutPlatform[];
  /** `"primary"` = ⌘ on macOS, Ctrl elsewhere. Explicit flags are exact. */
  primary?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

const RULES: readonly CollisionRule[] = [
  // System
  { id: "spotlight", platforms: ["mac"], meta: true, codes: ["Space"] },
  { id: "inputSourceMac", platforms: ["mac"], ctrl: true, codes: ["Space"] },
  { id: "inputSourceSuper", platforms: ["windows", "linux"], meta: true, codes: ["Space"] },
  { id: "windowMenu", platforms: ["windows", "linux"], alt: true, codes: ["Space"] },
  { id: "altTab", platforms: ["windows", "linux"], alt: true, codes: ["Tab"] },
  { id: "closeWindow", platforms: ["windows", "linux"], alt: true, codes: ["F4"] },
  { id: "quitApp", platforms: ["mac"], meta: true, codes: ["KeyQ"] },
  // Browser (⌘ on macOS, Ctrl elsewhere) — also with Shift (reopen tab, incognito, …)
  { id: "browserCloseTab", primary: true, codes: ["KeyW"] },
  { id: "browserCloseTab", primary: true, shift: true, codes: ["KeyW"] },
  { id: "browserNewTab", primary: true, codes: ["KeyT"] },
  { id: "browserNewTab", primary: true, shift: true, codes: ["KeyT"] },
  { id: "browserNewWindow", primary: true, codes: ["KeyN"] },
  { id: "browserNewWindow", primary: true, shift: true, codes: ["KeyN"] },
  { id: "quitApp", platforms: ["windows", "linux"], primary: true, codes: ["KeyQ"] },
  { id: "quitApp", platforms: ["windows", "linux"], primary: true, shift: true, codes: ["KeyQ"] },
  { id: "browserReload", primary: true, codes: ["KeyR"] },
  { id: "browserReload", primary: true, shift: true, codes: ["KeyR"] },
  { id: "browserLocation", primary: true, codes: ["KeyL"] },
  { id: "browserPrint", primary: true, codes: ["KeyP"] },
  { id: "browserFind", primary: true, codes: ["KeyF", "KeyG"] },
  { id: "browserSave", primary: true, codes: ["KeyS"] },
  { id: "browserEditing", primary: true, codes: ["KeyA", "KeyC", "KeyV", "KeyX", "KeyZ", "KeyY"] },
  {
    id: "browserTabSelect",
    primary: true,
    codes: [
      "Digit1",
      "Digit2",
      "Digit3",
      "Digit4",
      "Digit5",
      "Digit6",
      "Digit7",
      "Digit8",
      "Digit9",
    ],
  },
  { id: "browserTabSwitch", platforms: ["windows", "linux"], ctrl: true, codes: ["Tab"] },
  {
    id: "browserTabSwitch",
    platforms: ["windows", "linux"],
    ctrl: true,
    shift: true,
    codes: ["Tab"],
  },
  { id: "browserTabSwitch", platforms: ["mac"], ctrl: true, codes: ["Tab"] },
  {
    id: "browserBackForward",
    platforms: ["windows", "linux"],
    alt: true,
    codes: ["ArrowLeft", "ArrowRight"],
  },
  {
    id: "browserBackForward",
    platforms: ["mac"],
    meta: true,
    codes: ["BracketLeft", "BracketRight"],
  },
  { id: "browserLocation", platforms: ["windows", "linux"], alt: true, codes: ["KeyD"] },
  // App: ⌘/Ctrl+K opens this app's command palette
  { id: "commandPalette", primary: true, codes: ["KeyK"] },
  // App: a bare `n` opens New Task
  { id: "newTask", codes: ["KeyN"] },
  // Function keys
  { id: "browserHelp", codes: ["F1"] },
  { id: "browserFind", codes: ["F3"] },
  { id: "browserReload", codes: ["F5"] },
  { id: "browserReload", ctrl: true, codes: ["F5"] },
  { id: "browserFullscreen", codes: ["F11"] },
  { id: "browserDevtools", codes: ["F12"] },
];

function ruleMatches(
  rule: CollisionRule,
  shortcut: ZibbyShortcut,
  platform: ShortcutPlatform,
): boolean {
  if (rule.platforms && !rule.platforms.includes(platform)) return false;
  if (!rule.codes.includes(shortcut.code)) return false;
  const mac = platform === "mac";
  const wantMeta = rule.meta ?? (rule.primary ? mac : false);
  const wantCtrl = rule.ctrl ?? (rule.primary ? !mac : false);
  return (
    shortcut.alt === (rule.alt ?? false) &&
    shortcut.ctrl === wantCtrl &&
    shortcut.meta === wantMeta &&
    shortcut.shift === (rule.shift ?? false)
  );
}

/** The id of a known system/browser/app combination this shortcut would shadow, or `null`. */
export function shortcutCollision(
  shortcut: ZibbyShortcut,
  platform: ShortcutPlatform,
): ShortcutCollisionId | null {
  for (const rule of RULES) {
    if (ruleMatches(rule, shortcut, platform)) return rule.id;
  }
  return null;
}
