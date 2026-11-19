import type { ReactNode, Ref } from "react";
import { LAYOUT } from "../../tokens";
import { Icon } from "../Icon/Icon";

export enum MobileToolbarTestId {
  Root = "mobile-toolbar-root",
  Bar = "mobile-toolbar-bar",
  Leading = "mobile-toolbar-leading",
  Brand = "mobile-toolbar-brand",
  Title = "mobile-toolbar-title",
  Actions = "mobile-toolbar-actions",
  Banner = "mobile-toolbar-banner",
  BannerAction = "mobile-toolbar-banner-action",
}

export interface MobileToolbarProps {
  /** Left slot - the menu button. */
  leading?: ReactNode;
  /** Brand knot, right after the menu (a link home, or a `BrandMark`). */
  brand?: ReactNode;
  /** Current section title, after the brand. */
  title?: ReactNode;
  /** Right-aligned row of icon-only controls. */
  actions?: ReactNode;
  /** Autopilot band under the bar (amber): the message, e.g. "Autopilot on - agents act
   *  without asking". Omit for no band. */
  banner?: ReactNode;
  /** Right end of the band, e.g. a "Change" link/button. */
  bannerAction?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/**
 * The phone's replacement for `AppHeader`: a `LAYOUT.headerHeight` (52px) bar -
 * menu, brand knot, section title, then a right-aligned row of icon actions -
 * with an optional amber Autopilot band beneath it.
 */
export function MobileToolbar({
  leading,
  brand,
  title,
  actions,
  banner,
  bannerAction,
  ref,
}: MobileToolbarProps) {
  return (
    <header data-testid={MobileToolbarTestId.Root} ref={ref}>
      <div
        className="relative z-[5] flex items-center gap-1 border-b border-line bg-panel pr-2 pl-1.5"
        data-testid={MobileToolbarTestId.Bar}
        style={{ height: LAYOUT.headerHeight }}
      >
        {leading && (
          <div className="flex shrink-0 items-center" data-testid={MobileToolbarTestId.Leading}>
            {leading}
          </div>
        )}
        {brand && (
          <div className="flex shrink-0 items-center p-1" data-testid={MobileToolbarTestId.Brand}>
            {brand}
          </div>
        )}
        {title && (
          <span
            className="min-w-0 truncate font-sans text-[15px] font-semibold tracking-[-0.015em] text-ink"
            data-testid={MobileToolbarTestId.Title}
          >
            {title}
          </span>
        )}
        <div
          className="ml-auto flex min-w-0 items-center justify-end gap-1"
          data-testid={MobileToolbarTestId.Actions}
        >
          {actions}
        </div>
      </div>
      {banner && (
        <div
          className="flex items-center gap-2 border-b border-line-2 bg-ink/[0.06] px-3.5 py-2 font-sans text-[12.5px] text-ink-2"
          data-testid={MobileToolbarTestId.Banner}
        >
          <Icon name="pause" size="xs" stroke="medium" />
          <span className="min-w-0 [&_b]:font-semibold [&_b]:text-ink">{banner}</span>
          {bannerAction && (
            <span
              className="ml-auto shrink-0 font-medium text-ink"
              data-testid={MobileToolbarTestId.BannerAction}
            >
              {bannerAction}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
