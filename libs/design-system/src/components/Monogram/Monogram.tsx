import type { Ref } from "react";

export enum MonogramTestId {
  Root = "monogram-root",
}

export interface MonogramProps {
  /** Full name — the initials and the stable pastel hue derive from it. */
  name: string;
  /** Px side of the square. */
  size?: number;
  /** `soft` = rounded square (an agent), `round` = circle (a person). */
  shape?: "soft" | "round";
  ref?: Ref<HTMLSpanElement>;
}

/** Stable 0-359 hue for a name (design `hue()`), so one agent keeps one colour everywhere. */
export function monogramHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** First letter plus the next lowercase letter of the first word, or two initials of a two-word name. */
export function monogramInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [first = "", second] = words;
  if (second) return (first.charAt(0) + second.charAt(0)).toUpperCase();
  return first.charAt(0).toUpperCase() + first.charAt(1).toLowerCase();
}

/** A pastel monogram tile (design `.ls-av`): initials on a name-derived hue, scaled to `size`. */
export function Monogram({ name, size = 24, shape = "soft", ref }: MonogramProps) {
  const hue = monogramHue(name);
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center font-semibold leading-none tracking-[-0.02em] ${shape === "round" ? "rounded-full" : "rounded-[30%]"}`}
      data-testid={MonogramTestId.Root}
      ref={ref}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 38% 66%)`,
        color: `hsl(${hue} 30% 16%)`,
      }}
      title={name}
    >
      {monogramInitials(name)}
    </span>
  );
}
