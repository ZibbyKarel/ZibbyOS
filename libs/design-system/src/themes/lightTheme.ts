/**
 * Zibby 2.0 light theme — the light half of the "Zibby-2.0 Dashboard" design.
 *
 * See `darkTheme.ts` for the rationale and the design → token mapping. Values are
 * the `light` half of `design/bridge-redesign/tokens.json` (spec §7/§7b): status
 * hues one step darker (rose 600, emerald 700, sky 700, violet 600) so they work as
 * text and dot on white; amber stays the same fill as in dark — amber TEXT uses
 * `--color-accent-fg` (#9a5500, CSS-only token). No glow in light — `--gw` is `0px`.
 */
import type { Theme } from "../tokens";

export const lightTheme: Theme = {
  // ---- Neutrals ---------------------------------------------------------------
  colorBg: "#f5f5f2",
  colorPanel: "#ffffff",
  colorPanel2: "#f0f0ec",
  colorLine: "rgba(20, 22, 26, 0.09)",
  colorLine2: "rgba(20, 22, 26, 0.16)",
  colorInk: "#15171b",
  colorInk2: "#4a4f58",
  colorInk3: "#686d77",
  // The design has no background grid — kept as a token, painted transparent.
  colorGrid: "transparent",

  // ---- State vocabulary -------------------------------------------------------
  colorStateWork: "#7c3aed",
  colorStateThink: "#0369a1",
  colorStateBlock: "#f5a524",
  colorStateErr: "#e11d48",
  colorStateDone: "#047857",
  colorStateIdle: "#9ca3af",

  // ---- Effects — nothing glows in light ---------------------------------------
  glowWidth: "0px",
  dotRadius: "9999px",

  // ---- Legacy backgrounds -----------------------------------------------------
  colorBackgroundDeep: "#f5f5f2", // --bg
  colorBackground: "#f5f5f2", // --bg
  colorSurface: "#ffffff", // --panel
  colorElevated: "#f0f0ec", // --panel2
  colorRaised: "#e6e6e1", // design --p3
  colorHover: "#e6e6e1", // Bridge spec §7: p3 doubles as hover

  // ---- Legacy foreground — mapped onto ink/ink2/ink3 --------------------------
  colorForeground: "#15171b", // --ink
  colorForegroundDim: "#4a4f58", // --ink2
  colorForegroundFaint: "#686d77", // --ink3

  // ---- Legacy borders — mapped onto line/line2 --------------------------------
  colorBorder: "rgba(20, 22, 26, 0.09)", // --line
  colorBorderStrong: "rgba(20, 22, 26, 0.16)", // --line2

  // ---- Brand accent -----------------------------------------------------------
  colorAccent: "#f5a524",
  colorAccentDim: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
  colorAccentContrast: "#1a1204",
  colorAccentGlow: "color-mix(in srgb, var(--color-accent) 35%, transparent)",

  // ---- Legacy status — LEGACY_TONE_MAP: ok→done, warn→blocked, bad→error, run→working
  colorOk: "#047857",
  colorWarn: "#f5a524",
  colorDanger: "#e11d48",
  colorRun: "#7c3aed",

  // ---- Risk categories — the only categorical palette -------------------------
  colorRiskPayment: "#c9890a",
  colorRiskDeletion: "#e03030",
  colorRiskPush: "#7c3fb0",
  colorRiskSend: "#1d8fa5",

  // ---- Border radii -----------------------------------------------------------
  radiusDefault: "10px",
  radiusSm: "6px",
  radiusMd: "8px",
  radiusLg: "12px",
  radiusFull: "9999px",

  // ---- Shadows ----------------------------------------------------------------
  shadowCard: "0 1px 2px rgba(0, 0, 0, 0.06)",
  shadowModal: "0 12px 28px rgba(0, 0, 0, 0.1)",
  shadowGlowAccent: "none",

  // ---- Fonts — Geist / Geist Mono --------------------------------------------
  fontSans: "var(--font-sans, Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif)",
  fontMono:
    "var(--font-mono, 'Geist Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace)",
};
