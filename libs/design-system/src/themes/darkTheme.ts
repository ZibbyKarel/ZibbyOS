/**
 * Zibby 2.0 dark theme — adopted from the "Zibby-2.0 Dashboard" design
 * (claude.ai/design project `Zibby-2.0`, `Zibby-2.0-Dashboard-Standalone.html`),
 * values retuned to the Bridge redesign palette (`design/bridge-redesign/bridge.css`).
 *
 * Cool graphite neutrals, soft 10px corners, a single amber brand accent and a
 * Tailwind-ish status palette (violet / sky / amber / rose / emerald). Every value
 * here is the single source of truth — `globals.css`'s `[data-theme="dark"]` block
 * (and the `@theme` defaults) mirror this table so a CSS-only (no-JS/SSR) paint
 * matches it at runtime. Keep them in lockstep.
 *
 * Design → token mapping: `--bg-0` → bg, `--bg-1` → panel, `--bg-2` → panel2
 * (cards), `--bg-3` → raised, `--bg-hover` → hover, `--border`/`--border-2` →
 * line/line2, `--text-0/1/2` → ink/ink2/ink3, `--text-3` → idle.
 *
 * The legacy fields (`colorOk`, `colorWarn`, `colorDanger`, `colorRun`,
 * `colorBackground*`, `colorForeground*`, `colorBorder*`) keep deriving from the
 * state colors via `LEGACY_TONE_MAP` (`stateTone.ts`). `colorAccent` no longer
 * aliases a state: it is the design's brand accent. Density is untouched — it
 * lives in `--sp-*` / `[data-density]`, independent of the theme.
 */
import type { Theme } from "../tokens";

export const darkTheme: Theme = {
  // ---- Neutrals ---------------------------------------------------------------
  colorBg: "#0a0b0d",
  colorPanel: "#0f1114",
  colorPanel2: "#151820",
  colorLine: "rgba(255, 255, 255, 0.06)",
  colorLine2: "rgba(255, 255, 255, 0.11)",
  colorInk: "#eceef2",
  colorInk2: "#a6acb7",
  colorInk3: "#80868f",
  // The design has no background grid — kept as a token, painted transparent.
  colorGrid: "transparent",

  // ---- State vocabulary (working → thinking → blocked → error → done → idle) --
  colorStateWork: "#a78bfa",
  colorStateThink: "#7dd3fc",
  colorStateBlock: "#f5a524",
  colorStateErr: "#fb7185",
  colorStateDone: "#34d399",
  colorStateIdle: "#6b7280",

  // ---- Effects — only live status glows, only in dark -------------------------
  glowWidth: "8px",
  dotRadius: "9999px",

  // ---- Legacy backgrounds -----------------------------------------------------
  colorBackgroundDeep: "#0a0b0d", // --bg
  colorBackground: "#0a0b0d", // --bg
  colorSurface: "#0f1114", // --panel
  colorElevated: "#151820", // --panel2
  colorRaised: "#1c2029", // design --bg-3
  colorHover: "#1c2029", // Bridge spec §7: p3 doubles as hover

  // ---- Legacy foreground — mapped onto ink/ink2/ink3 --------------------------
  colorForeground: "#eceef2", // --ink
  colorForegroundDim: "#a6acb7", // --ink2
  colorForegroundFaint: "#80868f", // --ink3

  // ---- Legacy borders — mapped onto line/line2 --------------------------------
  colorBorder: "rgba(255, 255, 255, 0.06)", // --line
  colorBorderStrong: "rgba(255, 255, 255, 0.11)", // --line2

  // ---- Brand accent -----------------------------------------------------------
  colorAccent: "#f5a524",
  colorAccentDim: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
  colorAccentContrast: "#1a1204",
  colorAccentGlow: "color-mix(in srgb, var(--color-accent) 35%, transparent)",

  // ---- Legacy status — LEGACY_TONE_MAP: ok→done, warn→blocked, bad→error, run→working
  colorOk: "#34d399",
  colorWarn: "#f5a524",
  colorDanger: "#fb7185",
  colorRun: "#a78bfa",

  // ---- Risk categories — the only categorical palette -------------------------
  colorRiskPayment: "#f0b429",
  colorRiskDeletion: "#ff6b6b",
  colorRiskPush: "#b07cff",
  colorRiskSend: "#56c4d6",

  // ---- Border radii — design `--radius` 10px / `--radius-sm` 6px --------------
  radiusDefault: "10px",
  radiusSm: "6px",
  radiusMd: "8px",
  radiusLg: "12px",
  radiusFull: "9999px",

  // ---- Shadows — design `--shadow-1` (cards) / `--shadow-2` (overlays) --------
  shadowCard: "0 1px 2px rgba(0, 0, 0, 0.35)",
  shadowModal: "0 8px 24px rgba(0, 0, 0, 0.45)",
  shadowGlowAccent: "0 0 var(--gw) var(--color-accent-glow)",

  // ---- Fonts — Geist / Geist Mono --------------------------------------------
  fontSans: "var(--font-sans, Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif)",
  fontMono:
    "var(--font-mono, 'Geist Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace)",
};
