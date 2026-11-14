import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import type { SubNavLinkComponent } from "../SubNav/SubNav";

export enum BriefingHeroTestId {
  Root = "briefing-hero-root",
  Eyebrow = "briefing-hero-eyebrow",
  Title = "briefing-hero-title",
  Lead = "briefing-hero-lead",
  Counters = "briefing-hero-counters",
  /** Suffixed with the counter's `id`: `briefing-hero-counter-needs`. */
  Counter = "briefing-hero-counter",
  /** Suffixed with the counter's `id`. */
  Value = "briefing-hero-value",
  /** A counter with an `href`, suffixed with its `id`. */
  Link = "briefing-hero-link",
}

/** Colour = state only: `accent` waits on you, `error` is failing, `dim` is quiet. */
export type BriefingHeroTone = "accent" | "error" | "dim";

export interface BriefingHeroCounter {
  id: string;
  label: string;
  value: string;
  tone?: BriefingHeroTone;
  /** Where the number leads; the whole counter becomes a link. */
  href?: string;
}

export interface BriefingHeroProps {
  /** Small line above the title (date, time). */
  eyebrow?: ReactNode;
  /** The greeting ("Good evening.") or the empty state ("A quiet day."). */
  title: ReactNode;
  /** One paragraph under the title. */
  lead?: ReactNode;
  counters: readonly BriefingHeroCounter[];
  /** `full` = desktop hero, `slim` = one-line title + small numerals (REVIEW),
   *  `phone` = 24px title + horizontally scrolling counter cards. */
  variant?: "full" | "slim" | "phone";
  ariaLabel?: string;
  /** Router-aware anchor for counter links (e.g. next/link); defaults to `<a>`. */
  linkComponent?: SubNavLinkComponent;
  ref?: Ref<HTMLElement>;
}

const TONE: Record<BriefingHeroTone | "none", string> = {
  accent: "text-accent-fg",
  error: "text-state-err",
  dim: "text-ink-3",
  none: "text-ink",
};

const TITLE = {
  full: "text-title-xl",
  slim: "text-[20px] leading-[26px] font-medium tracking-[-0.03em]",
  phone: "text-[24px] leading-[29px] font-medium tracking-[-0.025em]",
} as const;

const VALUE = {
  full: "text-display",
  slim: "text-[28px] leading-none font-light tracking-[-0.04em]",
  phone: "text-[26px] leading-[1.1] font-light tracking-[-0.03em]",
} as const;

/**
 * The Bridge briefing as a T0 hero (spec §2): no card chrome — an eyebrow, a greeting in
 * `title-xl`, one paragraph, and 3–5 big tabular numerals with small labels. Each numeral
 * can link to its detail page.
 */
export function BriefingHero({
  eyebrow,
  title,
  lead,
  counters,
  variant = "full",
  ariaLabel,
  linkComponent,
  ref,
}: BriefingHeroProps) {
  const Link = linkComponent ?? "a";
  const phone = variant === "phone";
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "box-border flex h-full font-sans",
        phone
          ? "flex-col gap-[12px] py-[10px]"
          : "flex-wrap content-end items-end gap-x-[48px] gap-y-[14px] px-[4px] pt-[6px] pb-[10px]",
      )}
      data-testid={BriefingHeroTestId.Root}
      data-variant={variant}
      ref={ref}
    >
      <div className={cn("min-w-0", !phone && "min-w-[260px] flex-1")}>
        {eyebrow && variant !== "slim" ? (
          <div
            className="mb-[8px] text-[12px] text-ink-3 first-letter:uppercase"
            data-testid={BriefingHeroTestId.Eyebrow}
          >
            {eyebrow}
          </div>
        ) : null}
        <h2 className={cn(TITLE[variant], "text-ink")} data-testid={BriefingHeroTestId.Title}>
          {title}
        </h2>
        {lead ? (
          <p
            className={cn(
              "mt-[8px] max-w-[660px] text-pretty text-ink-2",
              phone ? "text-[14px] leading-[1.55]" : "text-[15px] leading-[1.6]",
            )}
            data-testid={BriefingHeroTestId.Lead}
          >
            {lead}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "flex",
          phone
            ? "gap-[8px] overflow-x-auto pb-[4px] [scrollbar-width:none]"
            : variant === "slim"
              ? "gap-[24px]"
              : "flex-wrap gap-x-[30px] gap-y-[12px]",
        )}
        data-testid={BriefingHeroTestId.Counters}
      >
        {counters.map((c) => {
          const body = (
            <>
              <span
                className={cn(VALUE[variant], "tabular-nums", TONE[c.tone ?? "none"])}
                data-testid={`${BriefingHeroTestId.Value}-${c.id}`}
              >
                {c.value}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-ink-3",
                  phone ? "text-[11.5px]" : "text-[12px]",
                )}
              >
                {c.label}
              </span>
            </>
          );
          return (
            <div
              className={cn(
                "flex flex-col gap-[4px]",
                phone
                  ? "min-w-[92px] flex-none rounded-[12px] border border-line bg-panel px-[12px] py-[10px]"
                  : "min-w-[60px]",
              )}
              data-testid={`${BriefingHeroTestId.Counter}-${c.id}`}
              key={c.id}
            >
              {c.href ? (
                <Link
                  className={cn(
                    "flex flex-col gap-[4px] rounded-sm no-underline hover:opacity-80",
                    focusRing,
                  )}
                  data-testid={`${BriefingHeroTestId.Link}-${c.id}`}
                  href={c.href}
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
