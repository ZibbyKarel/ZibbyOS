import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";

export type TypographyType =
  | "pageTitle"
  | "title"
  | "subtitle"
  | "text"
  | "note"
  | "num"
  | "data"
  | "label"
  | "micro"
  // DS.md §3.1/§3.2 — added additively alongside the pre-ZibbyOS presets above
  // (which stay for existing callers; `title`/`label` are updated in place below).
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "bodyLg"
  | "body"
  | "bodySm"
  | "caption"
  | "metric"
  | "wordmark"
  | "labelSm"
  | "code";

export type TypographyVariant = "primary" | "secondary" | "tertiary";

/** Semantic colour override, takes precedence over `variant`. */
export type TypographyTone = "ok" | "bad" | "warn" | "run" | "accent";

export type TypographySize =
  | "2xs"
  | "xs"
  | "sm"
  | "caption"
  | "base"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

export type TypographyWeight = "normal" | "medium" | "semibold" | "bold";

export type TypographyTracking = "tighter" | "normal" | "wide" | "wider" | "widest" | "mono";

export type TypographyLeading = "tight" | "snug" | "normal" | "relaxed";

export type TypographyAlign = "left" | "center" | "right";

export enum TypographyTestId {
  Root = "typography-root",
}

type As = "h1" | "h2" | "h3" | "div" | "p" | "span" | "label";

interface TypePreset {
  tag: As;
  /** A named token on the existing `--text-*` scale. Omit when the preset needs an
   *  exact DS.md §3 px value the named scale doesn't carry — use {@link fontSizePx}. */
  size?: TypographySize;
  /** Exact px size (DS.md §3.1/§3.2) for a preset that doesn't fit the named `size`
   *  scale. Takes precedence over `size` when both would apply; ignored if the
   *  caller passes an explicit `size` prop. */
  fontSizePx?: number;
  weight: TypographyWeight;
  leading: number;
  mono?: boolean;
  uppercase?: boolean;
  tracking?: TypographyTracking;
  /** Exact em letter-spacing (DS.md §3) for a preset whose tracking value doesn't
   *  match a named `--tracking-*` token. Takes precedence over `tracking`. */
  letterSpacingEm?: number;
  /** `font-variant-numeric: tabular-nums` — DS.md's `metric` preset (stat values). */
  tabularNums?: boolean;
  variant?: TypographyVariant;
}

/**
 * Presets mapped onto the Bridge type scale (spec §5): title-xl 30 · title-l 22 ·
 * widget-t1 15 · body 13/20 · meta 12/16 · mono 11.5. Sentence case throughout —
 * the only caps is the `overline` look an explicit `uppercase` prop opts into.
 * Mono = ids, numbers, times, code; sans = everything else.
 */
const typePreset: Record<TypographyType, TypePreset> = {
  // title-l (22 / 28 / 600, −0.025em) — the page title ("Můstek").
  pageTitle: {
    tag: "h1",
    fontSizePx: 22,
    weight: "semibold",
    leading: 28 / 22,
    letterSpacingEm: -0.025,
  },
  // widget-t1 (15 / 20 / 600) — card / section titles.
  title: { tag: "h2", fontSizePx: 15, weight: "semibold", leading: 20 / 15, letterSpacingEm: 0 },
  // Sheet heading (17 / 600, −0.015em).
  subtitle: {
    tag: "h3",
    fontSizePx: 17,
    weight: "semibold",
    leading: 1.35,
    letterSpacingEm: -0.015,
  },
  text: { tag: "div", size: "base", weight: "normal", leading: 20 / 13 },
  note: { tag: "div", size: "caption", weight: "normal", leading: 1.5 },
  num: { tag: "span", size: "4xl", weight: "semibold", leading: 1, mono: true },
  data: {
    tag: "span",
    size: "sm",
    weight: "normal",
    leading: 1.6,
    mono: true,
    variant: "secondary",
  },
  // Field / group label — meta size, 500, ink-3, sentence case.
  label: {
    tag: "span",
    fontSizePx: 12,
    weight: "medium",
    leading: 16 / 12,
    variant: "tertiary",
  },
  micro: {
    tag: "span",
    size: "xs",
    weight: "normal",
    leading: 1.5,
    mono: true,
    variant: "tertiary",
  },

  // title-xl (30 / 35 / 500, −0.03em).
  display: {
    tag: "h1",
    fontSizePx: 30,
    weight: "medium",
    leading: 35 / 30,
    letterSpacingEm: -0.03,
  },
  h1: { tag: "h1", fontSizePx: 30, weight: "medium", leading: 35 / 30, letterSpacingEm: -0.03 },
  h2: { tag: "h2", fontSizePx: 22, weight: "semibold", leading: 28 / 22, letterSpacingEm: -0.025 },
  h3: { tag: "h3", fontSizePx: 15, weight: "semibold", leading: 20 / 15, letterSpacingEm: 0 },
  bodyLg: { tag: "div", fontSizePx: 15, weight: "normal", leading: 1.6, letterSpacingEm: 0 },
  // body (13 / 20).
  body: { tag: "div", fontSizePx: 13, weight: "normal", leading: 20 / 13, letterSpacingEm: 0 },
  bodySm: { tag: "div", fontSizePx: 12.5, weight: "normal", leading: 1.5, letterSpacingEm: 0 },
  // meta (12 / 16, ink-3).
  caption: {
    tag: "div",
    fontSizePx: 12,
    weight: "normal",
    leading: 16 / 12,
    letterSpacingEm: 0,
    variant: "tertiary",
  },
  metric: {
    tag: "span",
    fontSizePx: 20,
    weight: "medium",
    leading: 1.1,
    letterSpacingEm: 0,
    tabularNums: true,
  },

  // The logo wordmark (Bridge `.logo`: 600, −0.01em, sans).
  wordmark: {
    tag: "span",
    fontSizePx: 13,
    weight: "semibold",
    leading: 1.2,
    letterSpacingEm: -0.01,
  },
  labelSm: {
    tag: "span",
    fontSizePx: 11,
    weight: "medium",
    leading: 14 / 11,
    variant: "tertiary",
  },
  // mono (11.5 / 16) — agent names, IDs, log lines.
  code: {
    tag: "span",
    fontSizePx: 11.5,
    weight: "normal",
    leading: 16 / 11.5,
    mono: true,
    letterSpacingEm: 0,
    variant: "secondary",
  },
};

const variantClass: Record<TypographyVariant, string> = {
  primary: "text-foreground",
  secondary: "text-foreground-dim",
  tertiary: "text-foreground-faint",
};

const toneClass: Record<TypographyTone, string> = {
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-accent-fg",
  run: "text-run",
  accent: "text-accent-fg",
};

const weightClass: Record<TypographyWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const leadingValue: Record<TypographyLeading, number> = {
  tight: 1.2,
  snug: 1.3,
  normal: 1.4,
  relaxed: 1.6,
};

export interface TypographyProps extends Omit<HTMLAttributes<HTMLElement>, "className"> {
  /** Preset that drives the default tag, size, weight and leading. */
  type: TypographyType;
  /** Neutral foreground level. */
  variant?: TypographyVariant;
  /** Semantic colour; overrides `variant` when set. */
  tone?: TypographyTone;
  mono?: boolean;
  /** Override the preset font size. */
  size?: TypographySize;
  /** Override the preset font weight. */
  weight?: TypographyWeight;
  tracking?: TypographyTracking;
  leading?: TypographyLeading;
  uppercase?: boolean;
  truncate?: boolean;
  nowrap?: boolean;
  /** `overflow-wrap: anywhere` — wraps long unbroken tokens (branch names, URLs). */
  wrapAnywhere?: boolean;
  align?: TypographyAlign;
  /** Override the rendered element. */
  as?: As;
  ref?: Ref<HTMLElement>;
}

export function Typography({
  type,
  variant,
  tone,
  mono,
  size,
  weight,
  tracking,
  leading,
  uppercase,
  truncate,
  nowrap,
  wrapAnywhere,
  align,
  as,
  style,
  ref,
  ...rest
}: TypographyProps) {
  const preset = typePreset[type];
  const Element = as ?? preset.tag;
  // The caps rule (Bridge `overline`): uppercase text is always a sans 500 / .06em
  // divider label — never mono, and a caller's `tracking` is ignored. Mono stays for
  // machine data (IDs, numbers, logs).
  const caps = uppercase ?? preset.uppercase ?? false;

  // A caller-supplied `size`/`tracking` always wins (named-token overrides); otherwise
  // an exact DS.md px value (`fontSizePx`/`letterSpacingEm`) wins over a named token,
  // since it's how a preset like `display`/`h1`/`metric` expresses a size the
  // `--text-*`/`--tracking-*` scales don't carry — see `TypePreset`.
  const resolvedFontSize = size
    ? `var(--text-${size})`
    : (preset.fontSizePx ?? preset.size)
      ? preset.fontSizePx !== undefined
        ? `${preset.fontSizePx}px`
        : `var(--text-${preset.size})`
      : undefined;
  const resolvedLetterSpacing = caps
    ? preset.letterSpacingEm !== undefined
      ? `${preset.letterSpacingEm}em`
      : "0.06em"
    : tracking
      ? `var(--tracking-${tracking})`
      : preset.letterSpacingEm !== undefined
        ? `${preset.letterSpacingEm}em`
        : preset.tracking
          ? `var(--tracking-${preset.tracking})`
          : undefined;

  const computedStyle: CSSProperties = {
    fontSize: resolvedFontSize,
    lineHeight: leading ? leadingValue[leading] : preset.leading,
    ...(resolvedLetterSpacing ? { letterSpacing: resolvedLetterSpacing } : {}),
    ...(preset.tabularNums ? { fontVariantNumeric: "tabular-nums" } : {}),
    ...(align ? { textAlign: align } : {}),
    ...style,
  };

  return (
    <Element
      className={cn(
        weightClass[weight ?? (caps ? "medium" : preset.weight)],
        tone ? toneClass[tone] : variantClass[variant ?? preset.variant ?? "primary"],
        caps ? "font-sans uppercase" : (mono ?? preset.mono) && "font-mono",
        truncate && "truncate",
        nowrap && "whitespace-nowrap",
        wrapAnywhere && "wrap-anywhere",
      )}
      data-testid={TypographyTestId.Root}
      ref={
        ref as Ref<
          HTMLHeadingElement &
            HTMLDivElement &
            HTMLParagraphElement &
            HTMLSpanElement &
            HTMLLabelElement
        >
      }
      style={computedStyle}
      {...rest}
    />
  );
}
