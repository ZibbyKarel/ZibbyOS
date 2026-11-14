import type { HTMLAttributes } from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { type AnyStateTone, type StateTone, normalizeToneLike } from "../../stateTone";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "../Icon/Icon";

/**
 * Risk categories — the design system's one categorical palette
 * ("color = state, shape = category"; everything else is glyph + text).
 */
export type RiskKind = "payment" | "deletion" | "push" | "send";

/** The canonical {@link StateTone} palette, plus `neutral` and the risk kinds — cva's
 *  `tone` variant, resolved from {@link TagTone} via `normalizeToneLike` (see `Tag()`). */
type CanonicalTagTone = StateTone | "neutral" | RiskKind;

/** {@link CanonicalTagTone}, plus the legacy vocabulary (see {@link AnyStateTone}) —
 *  the public prop type. */
export type TagTone = AnyStateTone | "neutral" | RiskKind;

// Keyed by the canonical `StateTone` (+ `neutral` + risk kinds) — legacy classes
// reused where the color is identical (LEGACY_TONE_MAP). See `Tag()` for the resolve
// step; cva matches `tone` against these keys directly, so the resolve must happen
// before `tag()` is called.
// Bridge `.chip` look: a state-tinted fill, no visible border. `thinking` keeps the
// legacy amber (`accent`) reading here; amber text uses `accent-fg`.
const toneClass: Record<CanonicalTagTone, string> = {
  neutral: "text-ink-2 bg-ink/[0.045]",
  thinking: "text-accent-fg bg-accent/[0.12]",
  done: "text-ok bg-ok/[0.09]",
  blocked: "text-accent-fg bg-warn/[0.12]",
  error: "text-bad bg-bad/10",
  working: "text-run bg-run/10",
  idle: "text-ink-3 bg-state-idle/10",
  payment: "text-risk-payment bg-risk-payment/10",
  deletion: "text-risk-deletion bg-risk-deletion/10",
  push: "text-risk-push bg-risk-push/10",
  send: "text-risk-send bg-risk-send/10",
};

const tag = cva(
  "inline-flex items-center gap-1 font-sans text-[11.5px] font-medium " +
    "rounded-sm border border-transparent whitespace-nowrap",
  {
    variants: {
      tone: toneClass,
      size: {
        sm: "h-[20px] px-[7px]",
        md: "h-[24px] px-2",
      },
      solid: { true: "", false: "" },
      // Sentence case everywhere (Bridge): kept for API compatibility, renders as-is.
      uppercase: { true: "", false: "" },
    },
    compoundVariants: [
      { tone: "neutral", solid: true, className: "bg-ink text-on-ink border-transparent" },
      {
        tone: "thinking",
        solid: true,
        className: "bg-accent text-accent-contrast border-transparent",
      },
      { tone: "done", solid: true, className: "bg-ok text-on-status border-transparent" },
      {
        tone: "blocked",
        solid: true,
        className: "bg-warn text-accent-contrast border-transparent",
      },
      { tone: "error", solid: true, className: "bg-bad text-on-status border-transparent" },
      { tone: "working", solid: true, className: "bg-run text-on-status border-transparent" },
    ],
    defaultVariants: { tone: "neutral", solid: false, size: "sm" },
  },
);

/** Default glyph for each risk category — the canonical risk → icon mapping. */
export const riskIcon: Record<RiskKind, IconName> = {
  payment: "dollar",
  deletion: "trash",
  push: "branch",
  send: "arrow",
};

export enum TagTestId {
  Root = "tag-root",
  Icon = "tag-icon",
}

export interface TagProps
  extends
    Omit<HTMLAttributes<HTMLSpanElement>, "className">,
    Omit<VariantProps<typeof tag>, "tone"> {
  /** Toned emphasis — accepts both the canonical and the legacy vocabulary (see
   *  {@link AnyStateTone}), plus `neutral` and the risk kinds; resolved via
   *  `normalizeToneLike` before it reaches cva. */
  tone?: TagTone;
  /** Optional leading glyph (categorical marker — risk kind, channel, …). */
  icon?: IconName;
  ref?: React.Ref<HTMLSpanElement>;
}

/**
 * Angular label badge — a glyph + text tinted by `tone`. The "shape = category"
 * half of the badge family (the rounded {@link Chip} is the "color = state"
 * half). Toned by default; `solid` fills it. `uppercase` is a deprecated no-op —
 * the Bridge language keeps labels in sentence case.
 */
export function Tag({ tone, solid, size, uppercase, icon, children, ref, ...props }: TagProps) {
  const resolvedTone = tone ? normalizeToneLike(tone) : undefined;
  return (
    <span
      className={cn(tag({ tone: resolvedTone, solid, size, uppercase }))}
      data-testid={TagTestId.Root}
      ref={ref}
      {...props}
    >
      {icon && <Icon data-testid={TagTestId.Icon} name={icon} size="xs" />}
      {children}
    </span>
  );
}
