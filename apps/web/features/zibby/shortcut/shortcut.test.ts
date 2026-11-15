import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZIBBY_SHORTCUT,
  type ShortcutEventLike,
  type ZibbyShortcut,
  detectShortcutPlatform,
  formatShortcut,
  matchesShortcut,
  matchesZibbyShortcut,
  parseShortcut,
  serializeShortcut,
  shortcutCollision,
  shortcutFromEvent,
} from "./shortcut";

function ev(code: string, mods: Partial<Record<"alt" | "ctrl" | "meta" | "shift", boolean>> = {}) {
  return {
    code,
    altKey: mods.alt ?? false,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
  } satisfies ShortcutEventLike;
}

function sc(code: string, mods: Partial<Record<"alt" | "ctrl" | "meta" | "shift", boolean>> = {}) {
  return {
    code,
    alt: mods.alt ?? false,
    ctrl: mods.ctrl ?? false,
    meta: mods.meta ?? false,
    shift: mods.shift ?? false,
  } satisfies ZibbyShortcut;
}

describe("matching", () => {
  it("default is Alt+Space", () => {
    expect(DEFAULT_ZIBBY_SHORTCUT).toEqual(sc("Space", { alt: true }));
  });

  it("matches exactly the same modifiers", () => {
    expect(matchesShortcut(ev("Space", { alt: true }), DEFAULT_ZIBBY_SHORTCUT)).toBe(true);
    expect(matchesShortcut(ev("Space", { alt: true, shift: true }), DEFAULT_ZIBBY_SHORTCUT)).toBe(
      false,
    );
    expect(matchesShortcut(ev("Space"), DEFAULT_ZIBBY_SHORTCUT)).toBe(false);
    expect(matchesShortcut(ev("KeyA", { alt: true }), DEFAULT_ZIBBY_SHORTCUT)).toBe(false);
  });

  it("Ctrl+Space also matches the default on windows and linux", () => {
    for (const platform of ["windows", "linux"] as const) {
      expect(
        matchesZibbyShortcut(ev("Space", { ctrl: true }), DEFAULT_ZIBBY_SHORTCUT, platform),
      ).toBe(true);
      expect(
        matchesZibbyShortcut(ev("Space", { alt: true }), DEFAULT_ZIBBY_SHORTCUT, platform),
      ).toBe(true);
    }
  });

  it("Ctrl+Space does not match on macOS", () => {
    expect(matchesZibbyShortcut(ev("Space", { ctrl: true }), DEFAULT_ZIBBY_SHORTCUT, "mac")).toBe(
      false,
    );
    expect(matchesZibbyShortcut(ev("Space", { alt: true }), DEFAULT_ZIBBY_SHORTCUT, "mac")).toBe(
      true,
    );
  });

  it("the alias disappears once the shortcut is customised", () => {
    const custom = sc("KeyJ", { alt: true });
    expect(matchesZibbyShortcut(ev("Space", { ctrl: true }), custom, "windows")).toBe(false);
    expect(matchesZibbyShortcut(ev("KeyJ", { alt: true }), custom, "windows")).toBe(true);
    // Even a stored Alt+Space shortcut re-saved is still "default", but a different one is not.
    expect(
      matchesZibbyShortcut(
        ev("Space", { ctrl: true }),
        sc("Space", { alt: true, shift: true }),
        "linux",
      ),
    ).toBe(false);
  });
});

describe("shortcutFromEvent", () => {
  it("builds a shortcut from a modified key", () => {
    expect(shortcutFromEvent(ev("KeyJ", { meta: true, shift: true }))).toEqual(
      sc("KeyJ", { meta: true, shift: true }),
    );
  });

  it("rejects modifier-only presses", () => {
    expect(shortcutFromEvent(ev("AltLeft", { alt: true }))).toBeNull();
    expect(shortcutFromEvent(ev("ControlRight", { ctrl: true }))).toBeNull();
    expect(shortcutFromEvent(ev("MetaLeft", { meta: true }))).toBeNull();
    expect(shortcutFromEvent(ev("ShiftLeft", { shift: true }))).toBeNull();
  });

  it("rejects bare letters and Shift-only combos", () => {
    expect(shortcutFromEvent(ev("KeyN"))).toBeNull();
    expect(shortcutFromEvent(ev("Space"))).toBeNull();
    expect(shortcutFromEvent(ev("KeyA", { shift: true }))).toBeNull();
  });

  it("accepts a bare function key", () => {
    expect(shortcutFromEvent(ev("F6"))).toEqual(sc("F6"));
    expect(shortcutFromEvent(ev("F13"))).toEqual(sc("F13"));
  });
});

describe("serialize / parse", () => {
  it("serializes in canonical order", () => {
    expect(serializeShortcut(DEFAULT_ZIBBY_SHORTCUT)).toBe("Alt+Space");
    expect(serializeShortcut(sc("KeyK", { meta: true, shift: true, alt: true, ctrl: true }))).toBe(
      "Ctrl+Alt+Shift+Meta+KeyK",
    );
  });

  it("round-trips", () => {
    for (const s of [
      DEFAULT_ZIBBY_SHORTCUT,
      sc("KeyK", { meta: true }),
      sc("F6"),
      sc("Digit1", { ctrl: true, shift: true }),
      sc("KeyJ", { alt: true, ctrl: true, meta: true, shift: true }),
    ]) {
      expect(parseShortcut(serializeShortcut(s))).toEqual(s);
    }
  });

  it("parses tolerantly (case, spacing, aliases)", () => {
    expect(parseShortcut(" alt + Space ")).toEqual(DEFAULT_ZIBBY_SHORTCUT);
    expect(parseShortcut("Option+Space")).toEqual(DEFAULT_ZIBBY_SHORTCUT);
    expect(parseShortcut("cmd+KeyK")).toEqual(sc("KeyK", { meta: true }));
    expect(parseShortcut("Control+Space")).toEqual(sc("Space", { ctrl: true }));
  });

  it("returns null for garbage", () => {
    for (const raw of [
      null,
      undefined,
      42,
      {},
      "",
      "+",
      "Alt+",
      "Space",
      "KeyN",
      "Foo+Space",
      "Alt+Sp ace",
      "Alt+Alt",
      "Alt+ShiftLeft",
      '{"a":1}',
      "Alt+Space+",
    ]) {
      expect(parseShortcut(raw)).toBeNull();
    }
  });
});

describe("formatShortcut", () => {
  it("uses glyphs on macOS", () => {
    expect(formatShortcut(DEFAULT_ZIBBY_SHORTCUT, "mac")).toEqual(["⌥", "Space"]);
    expect(
      formatShortcut(sc("KeyK", { ctrl: true, alt: true, shift: true, meta: true }), "mac"),
    ).toEqual(["⌃", "⌥", "⇧", "⌘", "K"]);
  });

  it("uses words elsewhere", () => {
    expect(formatShortcut(DEFAULT_ZIBBY_SHORTCUT, "windows")).toEqual(["Alt", "Space"]);
    expect(formatShortcut(DEFAULT_ZIBBY_SHORTCUT, "linux")).toEqual(["Alt", "Space"]);
    expect(formatShortcut(sc("KeyK", { meta: true }), "windows")).toEqual(["Win", "K"]);
    expect(formatShortcut(sc("KeyK", { meta: true }), "linux")).toEqual(["Super", "K"]);
  });

  it("labels keys", () => {
    expect(formatShortcut(sc("Digit1", { ctrl: true }), "linux")).toEqual(["Ctrl", "1"]);
    expect(formatShortcut(sc("ArrowUp", { alt: true }), "linux")).toEqual(["Alt", "↑"]);
    expect(formatShortcut(sc("F6"), "linux")).toEqual(["F6"]);
    expect(formatShortcut(sc("Slash", { ctrl: true }), "linux")).toEqual(["Ctrl", "/"]);
  });
});

describe("shortcutCollision", () => {
  it("flags macOS system combos", () => {
    expect(shortcutCollision(sc("Space", { meta: true }), "mac")).toBe("spotlight");
    expect(shortcutCollision(sc("Space", { ctrl: true }), "mac")).toBe("inputSourceMac");
    expect(shortcutCollision(sc("KeyQ", { meta: true }), "mac")).toBe("quitApp");
  });

  it("flags Windows/Linux system combos", () => {
    expect(shortcutCollision(sc("Space", { alt: true }), "windows")).toBe("windowMenu");
    expect(shortcutCollision(sc("Space", { alt: true }), "linux")).toBe("windowMenu");
    expect(shortcutCollision(sc("Space", { meta: true }), "windows")).toBe("inputSourceSuper");
    expect(shortcutCollision(sc("Tab", { alt: true }), "windows")).toBe("altTab");
  });

  it("does not flag the default on macOS", () => {
    expect(shortcutCollision(DEFAULT_ZIBBY_SHORTCUT, "mac")).toBeNull();
  });

  it("flags browser combos using the platform's primary modifier", () => {
    for (const [code, id] of [
      ["KeyW", "browserCloseTab"],
      ["KeyT", "browserNewTab"],
      ["KeyN", "browserNewWindow"],
      ["KeyR", "browserReload"],
      ["KeyL", "browserLocation"],
      ["KeyP", "browserPrint"],
      ["KeyF", "browserFind"],
    ] as const) {
      expect(shortcutCollision(sc(code, { meta: true }), "mac")).toBe(id);
      expect(shortcutCollision(sc(code, { ctrl: true }), "windows")).toBe(id);
      // The other platform's modifier is not the browser one.
      expect(shortcutCollision(sc(code, { ctrl: true }), "mac")).toBeNull();
    }
    expect(shortcutCollision(sc("KeyQ", { ctrl: true }), "linux")).toBe("quitApp");
    expect(shortcutCollision(sc("KeyT", { ctrl: true, shift: true }), "linux")).toBe(
      "browserNewTab",
    );
  });

  it("flags this app's own shortcuts", () => {
    expect(shortcutCollision(sc("KeyK", { meta: true }), "mac")).toBe("commandPalette");
    expect(shortcutCollision(sc("KeyK", { ctrl: true }), "linux")).toBe("commandPalette");
    expect(shortcutCollision(sc("KeyN"), "linux")).toBe("newTask");
  });

  it("flags function keys", () => {
    expect(shortcutCollision(sc("F5"), "mac")).toBe("browserReload");
    expect(shortcutCollision(sc("F12"), "windows")).toBe("browserDevtools");
    expect(shortcutCollision(sc("F6"), "windows")).toBeNull();
  });

  it("returns null for a free combination", () => {
    expect(shortcutCollision(sc("KeyJ", { alt: true, shift: true }), "mac")).toBeNull();
    expect(shortcutCollision(sc("Space", { alt: true, shift: true }), "windows")).toBeNull();
  });
});

describe("detectShortcutPlatform", () => {
  it("detects from the navigator", () => {
    expect(detectShortcutPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(
      detectShortcutPlatform({ platform: "", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS)" }),
    ).toBe("mac");
    expect(detectShortcutPlatform({ platform: "Win32" })).toBe("windows");
    expect(detectShortcutPlatform({ platform: "Linux x86_64" })).toBe("linux");
  });

  it("falls back to linux without a navigator", () => {
    expect(detectShortcutPlatform(undefined)).toBe("linux");
  });
});
