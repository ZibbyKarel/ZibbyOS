import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

export enum SubNavTestId {
  Root = "subnav-root",
  List = "subnav-list",
  Item = "subnav-item",
  Actions = "subnav-actions",
  Trail = "subnav-trail",
  /** Counter pill, suffixed with the item `href`. */
  Count = "subnav-count",
}

export interface SubNavItem {
  href: string;
  label: string;
  /** Optional leading glyph (mockup: Znalosti tabs). Omit for none. */
  icon?: IconName;
  active?: boolean;
  /** Counter pill after the label (e.g. open items). Omit for none. */
  count?: number | string;
  /** `attention` = amber pill (something waits for the operator). */
  countTone?: "default" | "attention";
}

/** An anchor-shaped component contract — matches both a plain `<a>` and Next's
 *  `Link` (same prop surface), so an app can pass its router's `Link` in
 *  without the DS ever importing `next/link` (chrome stays router-agnostic). */
export type SubNavLinkComponent = ComponentType<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode }
>;

export interface SubNavProps {
  items: SubNavItem[];
  /** Right-aligned slot (e.g. "+ NEW TASK") — DS App mock's subnav row. */
  actions?: ReactNode;
  /** Overrides the rendered anchor — pass the app's `next/link` `Link` to get
   *  client-side navigation. Defaults to a plain `<a>`. */
  linkComponent?: SubNavLinkComponent;
  /**
   * `"horizontal"` (default) — the DS App mock's top strip, an `--ink`
   * underline on the active item. `"responsive"` (ZB-11 Settings sub-nav)
   * renders the SAME strip below the `lg` breakpoint (≥1024px) and switches to
   * a left-hand column — a vertical list with a left-edge active indicator —
   * at `lg:` and up, so a section with many sub-pages (Settings) doesn't force
   * a cramped horizontal scroller on desktop.
   */
  orientation?: "horizontal" | "responsive";
  /** Slot right after the link list (e.g. a breadcrumb continuing the active item). */
  trail?: ReactNode;
}

const itemClass = (active: boolean, responsive: boolean) =>
  cn(
    "relative inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-[13px]",
    "transition-colors motion-reduce:transition-none",
    focusRingInset,
    responsive ? "h-9 px-2.5 lg:h-auto lg:w-full lg:border-l lg:px-3 lg:py-2" : "h-full px-2.5",
    // Row-2 tab: 2px ink underline overlaying the row's bottom hairline; the
    // responsive column (lg+) swaps it for a left-edge indicator.
    "after:absolute after:right-2.5 after:bottom-0 after:left-2.5 after:h-0.5 after:rounded-t-[2px]",
    responsive && "lg:border-transparent lg:after:hidden",
    active
      ? cn("font-medium text-ink after:bg-ink", responsive && "lg:border-ink")
      : "text-ink-3 after:bg-transparent hover:text-ink",
  );

/**
 * Top-chrome row 2 (42px) - sentence-case tab links, the active one in ink
 * with a 2px ink underline, optional counter pills (`count` / `countTone`), plus a
 * right-aligned `actions` slot. Narrow (phone), the tabs scroll on their own axis. Unlike {@link Tabs}
 * (an internal active/value state machine), `SubNav` is route-driven: `active`
 * comes from the caller's own route match, and each item is a real link.
 *
 * `orientation="responsive"` (ZB-11) keeps the same strip on narrow viewports
 * and reflows into a left-hand vertical column at `lg:` — see {@link SubNavProps}.
 */
export function SubNav({
  items,
  actions,
  linkComponent,
  orientation = "horizontal",
  trail,
}: SubNavProps) {
  const Link = linkComponent ?? "a";
  const responsive = orientation === "responsive";
  // Scrolls on its own axis (no scrollbar - the phone row-2 strip); `-mb-px` lets the
  // tab underline sit over the row's bottom hairline instead of being clipped by it.
  const scroller = "flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]";
  const nav = (
    <nav
      className={cn(
        "flex items-stretch gap-0.5",
        responsive &&
          "overflow-x-auto border-b border-line lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r",
      )}
      data-testid={SubNavTestId.List}
    >
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={itemClass(Boolean(item.active), responsive)}
          data-testid={`${SubNavTestId.Item}-${item.href}`}
          href={item.href}
          key={item.href}
        >
          {item.icon && <Icon name={item.icon} size="md" />}
          {item.label}
          {item.count != null && (
            <span
              className={cn(
                "inline-grid h-[17px] min-w-[18px] place-items-center rounded-full px-[5px] font-mono text-[10.5px] font-medium",
                item.countTone === "attention"
                  ? "bg-accent-soft text-accent-fg"
                  : "bg-ink/7 text-ink-2",
              )}
              data-testid={`${SubNavTestId.Count}-${item.href}`}
            >
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
  const trailEl = trail ? (
    <div className="flex min-w-0 items-center pl-1.5" data-testid={SubNavTestId.Trail}>
      {trail}
    </div>
  ) : null;
  return (
    <div
      className={cn(
        "flex",
        responsive
          ? "flex-col lg:h-full lg:items-stretch lg:justify-start"
          : "items-stretch justify-between gap-1 border-b border-line pl-1 pr-1 md:pr-3.5 md:pl-[var(--subnav-inset,0.875rem)]",
      )}
      data-testid={SubNavTestId.Root}
      // Fills the fixed-height row `AppFrame` reserves for it (`LAYOUT.subNavHeight`)
      // so its items' own `h-full` (itemClass) resolves against a real size —
      // a no-op when an ancestor gives no height (e.g. Storybook in isolation).
      style={{ height: "100%" }}
    >
      {/* Narrower than its content (a phone), the links scroll on their own axis
          while the actions stay put at the right. */}
      {trail ? (
        <div className={cn(scroller, !responsive && "-mb-px")}>
          {nav}
          {trailEl}
        </div>
      ) : responsive ? (
        nav
      ) : (
        <div className={cn(scroller, !responsive && "-mb-px")}>{nav}</div>
      )}
      {actions && (
        <div
          className={cn("ml-auto flex shrink-0 items-center gap-1.5", responsive && "px-3 py-2")}
          data-testid={SubNavTestId.Actions}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
