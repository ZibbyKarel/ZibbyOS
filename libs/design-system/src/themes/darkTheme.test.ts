import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stateToneHex } from "../stateTone";
import { darkTheme } from "./darkTheme";
import { lightTheme } from "./lightTheme";

describe("Zibby 2.0 theme alignment", () => {
  it("maps the design's text-2 onto foreground-faint", () => {
    expect(darkTheme.colorForegroundFaint).toBe("#80868f");
    expect(darkTheme.colorInk3).toBe("#80868f");
  });

  it("carries no glass recipe", () => {
    expect(Object.keys(darkTheme).some((k) => /glass/i.test(k))).toBe(false);
  });

  it("uses the design's soft radii in both themes", () => {
    for (const theme of [darkTheme, lightTheme]) {
      expect(theme.radiusDefault).toBe("10px");
      expect(theme.radiusSm).toBe("6px");
      expect(theme.radiusFull).toBe("9999px");
    }
  });

  it("glows only in dark (`--gw` non-zero)", () => {
    expect(darkTheme.glowWidth).toBe("8px");
    expect(lightTheme.glowWidth).toBe("0px");
  });

  it("maps the legacy tone vocabulary onto the state colors (LEGACY_TONE_MAP)", () => {
    for (const theme of [darkTheme, lightTheme]) {
      expect(theme.colorOk).toBe(theme.colorStateDone);
      expect(theme.colorWarn).toBe(theme.colorStateBlock);
      expect(theme.colorDanger).toBe(theme.colorStateErr);
      expect(theme.colorRun).toBe(theme.colorStateWork);
    }
  });

  it("running is violet, done is emerald, and the hex fallbacks mirror dark", () => {
    expect(darkTheme.colorStateWork).toBe("#a78bfa");
    expect(darkTheme.colorStateDone).toBe("#34d399");
    expect(lightTheme.colorStateWork).toBe("#7c3aed");
    expect(lightTheme.colorStateDone).toBe("#047857");
    expect(stateToneHex).toMatchObject({
      working: darkTheme.colorStateWork,
      thinking: darkTheme.colorStateThink,
      blocked: darkTheme.colorStateBlock,
      error: darkTheme.colorStateErr,
      done: darkTheme.colorStateDone,
      idle: darkTheme.colorStateIdle,
    });
  });
});

// ---------------------------------------------------------------------------
// design/bridge-redesign/tokens.json is the source of truth: every colour token
// must land in globals.css's [data-theme="dark"|"light"] blocks with its value.
// ---------------------------------------------------------------------------
const root = join(__dirname, "../../../..");
const css = readFileSync(join(__dirname, "../theme/globals.css"), "utf8");
const tokens = JSON.parse(
  readFileSync(join(root, "design/bridge-redesign/tokens.json"), "utf8"),
) as { color: Record<string, Record<string, { $value: { dark: string; light: string } }>> };

/** tokens.json key → DS CSS var (existing DS names kept, new ones per spec §7). */
const CSS_VAR: Record<string, string> = {
  canvas: "--color-canvas",
  bg: "--color-bg",
  p1: "--color-panel",
  p2: "--color-panel-2",
  p3: "--color-raised",
  sheet: "--color-sheet",
  "sheet-2": "--color-sheet-2",
  paper: "--color-paper",
  device: "--color-device",
  "t1-from": "--color-tier1-from",
  "t1-to": "--color-tier1-to",
  "t1-under": "--color-t1-under",
  line: "--color-line",
  line2: "--color-line-2",
  ink: "--color-ink",
  ink2: "--color-ink-2",
  ink3: "--color-ink-3",
  "on-ink": "--color-on-ink",
  "on-amber": "--color-brand-contrast",
  "on-status": "--color-on-status",
  "av-ink": "--color-av-ink",
  amber: "--color-brand",
  "amber-hover": "--color-accent-hover",
  "amber-fg": "--color-accent-fg",
  violet: "--color-state-work",
  sky: "--color-state-think",
  rose: "--color-state-err",
  emerald: "--color-state-done",
  idle: "--color-state-idle",
  bar: "--color-bar",
  "bar-2": "--color-bar-2",
  sunk: "--color-sunk",
  "code-bg": "--color-code-bg",
  "shadow-t1": "--shadow-t1",
  "shadow-pop": "--shadow-pop",
  "shadow-device": "--shadow-device",
  "diff-no": "--color-diff-no",
  "diff-ink": "--color-diff-ink",
  "diff-add-no": "--color-diff-add-no",
  "diff-del-no": "--color-diff-del-no",
  "syn-k": "--color-syn-keyword",
  "syn-s": "--color-syn-string",
  "syn-c": "--color-syn-comment",
  "syn-t": "--color-syn-type",
};

/** `rgba(255,255,255,.06)` and `rgba(255, 255, 255, 0.06)` compare equal. */
const norm = (v: string) =>
  v
    .replace(/\s+/g, "")
    .replace(/([(,])\./g, "$10.")
    .toLowerCase();

function themeBlock(theme: "dark" | "light"): string {
  const m = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`));
  if (!m?.[1]) throw new Error(`no [data-theme="${theme}"] block`);
  return m[1];
}

describe("tokens.json parity", () => {
  const entries = Object.values(tokens.color).flatMap((group) => Object.entries(group));

  it("maps every tokens.json colour to a DS var", () => {
    expect(entries.map(([key]) => key).filter((key) => !CSS_VAR[key])).toEqual([]);
  });

  it.each(["dark", "light"] as const)(
    "globals.css [data-theme=%s] carries the design values",
    (theme) => {
      const block = themeBlock(theme);
      for (const [key, { $value }] of entries) {
        const name = CSS_VAR[key] ?? key;
        const decl = block.match(new RegExp(`\\s${name}:\\s*([^;]+);`))?.[1];
        expect(decl && norm(decl), `${theme} ${name}`).toBe(norm($value[theme]));
      }
    },
  );
});
