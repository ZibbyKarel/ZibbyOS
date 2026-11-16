import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";
import type { SubNavLinkComponent } from "../SubNav/SubNav";

export enum SectionTrackTestId {
  Root = "section-track-root",
  /** Each item is suffixed with its `href`, e.g. `section-track-item-/overview`. */
  Item = "section-track-item",
  Attention = "section-track-attention",
}

export interface SectionTrackItem {
  href: string;
  label: string;
  icon?: IconName;
  /** The current section (`aria-current="page"`). */
  active?: boolean;
  /** Amber dot: something in this section waits for the operator. */
  attention?: boolean;
  /** Icon only - the label moves to `aria-label`/`title` (narrow headers). */
  iconOnly?: boolean;
}

export interface SectionTrackProps {
  items: SectionTrackItem[];
  /** Accessible name of the `<nav>` landmark. */
  ariaLabel?: string;
  /** Overrides the rendered anchor - pass the app's `next/link` `Link`. */
  linkComponent?: SubNavLinkComponent;
  ref?: Ref<HTMLElement>;
}

/**
 * The header's section switcher: a pill track holding icon + label links, the
 * active one raised on a `--hover` chip. Route-driven (like `SubNav`) - `active`
 * comes from the caller's route match.
 */
export function SectionTrack({
  items,
  ariaLabel = "Sections",
  linkComponent,
  ref,
}: SectionTrackProps) {
  const Link = linkComponent ?? "a";
  return (
    <nav aria-label={ariaLabel} data-testid={SectionTrackTestId.Root} ref={ref}>
      <div className="flex gap-0.5 rounded-[10px] border border-line bg-ink/[0.035] p-[3px]">
        {items.map((item) => (
          <Link
            aria-current={item.active ? "page" : undefined}
            aria-label={item.iconOnly ? item.label : undefined}
            className={cn(
              "relative inline-flex h-7 items-center gap-1.5 rounded-[7px] font-sans text-[12.5px] font-medium whitespace-nowrap",
              "transition-colors motion-reduce:transition-none",
              item.iconOnly ? "w-[30px] justify-center" : "pr-[9px] pl-2",
              item.active
                ? "bg-raised text-ink shadow-[0_0_0_1px_var(--color-line-2)] [[data-theme=light]_&]:bg-panel [[data-theme=light]_&]:shadow-[0_1px_2px_rgba(20,22,26,0.08),0_0_0_1px_var(--color-line-2)]"
                : "text-ink-3 hover:bg-ink/5 hover:text-ink",
              focusRing,
            )}
            data-testid={`${SectionTrackTestId.Item}-${item.href}`}
            href={item.href}
            key={item.href}
            title={item.iconOnly ? item.label : undefined}
          >
            {item.icon && <Icon name={item.icon} size="md" />}
            {!item.iconOnly && item.label}
            {item.attention && (
              <span
                aria-hidden="true"
                className="absolute top-1 right-[3px] size-1.5 rounded-full bg-accent shadow-[0_0_0_2px_var(--color-panel)]"
                data-testid={SectionTrackTestId.Attention}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
