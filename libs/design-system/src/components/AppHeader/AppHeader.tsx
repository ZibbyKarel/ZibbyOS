import type { ReactNode, Ref } from "react";
import { LAYOUT } from "../../tokens";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon } from "../Icon/Icon";
import { BrandMark, type BrandMarkState } from "../BrandMark/BrandMark";
import { Row } from "../Stack/Stack";
import type { SubNavLinkComponent } from "../SubNav/SubNav";
import { Wordmark } from "../Wordmark/Wordmark";

export enum AppHeaderTestId {
  Root = "app-header-root",
  Wordmark = "app-header-wordmark",
  HomeLink = "app-header-home-link",
  /** Zone A - brand + section nav. */
  ZoneA = "app-header-zone-a",
  /** Centre - the search trigger, at the true centre of the header row. */
  ZoneSearch = "app-header-zone-search",
  /** Zone B - command: create, Zibby. */
  ZoneB = "app-header-zone-b",
  /** Zone C - system: status, mode, notifications, preferences. */
  ZoneC = "app-header-zone-c",
  Divider = "app-header-divider",
  Nav = "app-header-nav",
  Search = "app-header-search",
  SearchShortcut = "app-header-search-shortcut",
  Create = "app-header-create",
  Zibby = "app-header-zibby",
  Status = "app-header-status",
  Mode = "app-header-mode",
  Notifications = "app-header-notifications",
  Preferences = "app-header-preferences",
}

export interface AppHeaderProps {
  /** Brand mark, leading the header. Defaults to the `BrandMark` + `<Wordmark />` lockup. */
  wordmark?: ReactNode;
  /** Live knot state of the default mark (idle / agents working / something waits on the
   *  operator). Omit for the static emerald (`done`) brand mark.
   *  Ignored when a custom `wordmark` is passed. */
  markState?: BrandMarkState;
  /** Running release shown small under the default wordmark, e.g. `v0.2.1`.
   *  Ignored when a custom `wordmark` is passed. */
  version?: string;
  /** Href the brand mark (glyph + wordmark) links to. Omit to render it inert. */
  homeHref?: string;
  /** Accessible name for the brand mark link (only used when `homeHref` is set). */
  homeLabel?: string;
  /** Zone A, after the brand - the section nav (a `SectionTrack`). */
  nav?: ReactNode;
  /** Zone B - create trigger (a `HeaderNewButton`, + its menu). */
  create?: ReactNode;
  /** Zone B, last - summon button of the Zibby overlay (a `ZibbyChip`). */
  zibby?: ReactNode;
  /** Zone C, first - system status trigger (a `HeaderStatus`). */
  status?: ReactNode;
  /** Zone C - operating mode (a `HeaderModeGroup`). */
  mode?: ReactNode;
  /** Zone C - notification bell (a `HeaderIconButton`). */
  notifications?: ReactNode;
  /** Zone C, last - preferences & settings (a `HeaderIconButton`). */
  preferences?: ReactNode;
  /** Narrow header: hide the wordmark text (the knot still links home). */
  hideWordmark?: boolean;
  /** Narrow header: the search trigger shows only the icon and `⌘K`. */
  searchCompact?: boolean;
  /** Search trigger label - the control itself is built in and always shows
   *  `⌘K`. Omit `onSearchClick` to not render the trigger at all. */
  searchLabel?: string;
  onSearchClick?: () => void;
  /** Overrides the rendered anchor for `homeHref` - pass the app's
   *  `next/link` `Link`, same contract as `SubNav`/`Breadcrumb`. */
  linkComponent?: SubNavLinkComponent;
  ref?: Ref<HTMLElement>;
}

/**
 * Top-chrome row 1 - a fixed `LAYOUT.headerHeight` (52px) band on `--panel` with a
 * bottom hairline, a `1fr auto 1fr` grid so the search trigger sits at the true centre
 * (`min(560px, 40vw)` wide, just icon + `⌘K` when `searchCompact`): **A** brand + section nav
 * on the left; on the right **B** command (create, Zibby), a 1x22px divider and **C** system
 * (status, mode, notifications, preferences). Every slot is an opaque `ReactNode`
 * (domain-neutral, no `next/link` import here) except the search trigger, which
 * `AppHeader` renders itself so every screen gets the identical `⌘K` affordance.
 */
export function AppHeader({
  wordmark,
  markState,
  version,
  homeHref,
  homeLabel = "ZibbyOS",
  nav,
  create,
  zibby,
  status,
  mode,
  notifications,
  preferences,
  hideWordmark = false,
  searchCompact = false,
  searchLabel = "Search",
  onSearchClick,
  linkComponent,
  ref,
}: AppHeaderProps) {
  const HomeLink = linkComponent ?? "a";
  const mark = wordmark ?? (
    <Row align="center" style={{ gap: 8 }}>
      <BrandMark live={markState !== undefined} size={24} state={markState ?? "done"} />
      {!hideWordmark && (
        <span className="hidden md:inline-flex">
          <Wordmark size="sm" version={version} />
        </span>
      )}
    </Row>
  );
  return (
    <header
      className="relative z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-b border-line bg-panel pr-3.5 pl-4"
      data-testid={AppHeaderTestId.Root}
      ref={ref}
      style={{ height: LAYOUT.headerHeight }}
    >
      <div className="flex items-center gap-2.5" data-testid={AppHeaderTestId.ZoneA}>
        <div className="rounded-lg py-1 pr-1 pl-0.5" data-testid={AppHeaderTestId.Wordmark}>
          {homeHref ? (
            <HomeLink
              aria-label={homeLabel}
              className={cn("inline-flex items-center rounded-lg", focusRingInset)}
              data-testid={AppHeaderTestId.HomeLink}
              href={homeHref}
            >
              {mark}
            </HomeLink>
          ) : (
            mark
          )}
        </div>
        {nav && (
          <div className="min-w-0" data-testid={AppHeaderTestId.Nav}>
            {nav}
          </div>
        )}
      </div>

      <div
        className={cn("hidden md:flex", !searchCompact && "w-[min(560px,40vw)]")}
        data-testid={AppHeaderTestId.ZoneSearch}
      >
        {onSearchClick && (
          <button
            aria-label={searchLabel}
            className={cn(
              "inline-flex h-[30px] w-full items-center gap-[7px] rounded-lg border border-line-2 bg-bg py-0 pr-1.5 pl-[9px]",
              "font-sans text-[12.5px] whitespace-nowrap text-ink-3 transition-colors",
              "hover:border-ink-3 hover:text-ink",
              "focus-visible:border-ink-2 focus-visible:text-ink focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-ink)_12%,transparent)]",
              "outline-none",
            )}
            data-testid={AppHeaderTestId.Search}
            onClick={onSearchClick}
            type="button"
          >
            <Icon name="search" size="sm" />
            {!searchCompact && <span className="flex-1 text-left">{searchLabel}</span>}
            <span
              className="rounded-[4px] border border-line-2 px-[5px] py-px font-mono text-[10.5px] text-ink-3"
              data-testid={AppHeaderTestId.SearchShortcut}
            >
              ⌘K
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5">
        <div className="flex flex-none items-center gap-1.5" data-testid={AppHeaderTestId.ZoneB}>
          {create && <span data-testid={AppHeaderTestId.Create}>{create}</span>}
          {zibby && <span data-testid={AppHeaderTestId.Zibby}>{zibby}</span>}
        </div>

        <span
          aria-hidden="true"
          className="mx-1 hidden h-[22px] w-px flex-none bg-line-2 md:block"
          data-testid={AppHeaderTestId.Divider}
        />

        <div className="flex flex-none items-center gap-1.5" data-testid={AppHeaderTestId.ZoneC}>
          {status && <span data-testid={AppHeaderTestId.Status}>{status}</span>}
          {mode && <span data-testid={AppHeaderTestId.Mode}>{mode}</span>}
          {notifications && (
            <span data-testid={AppHeaderTestId.Notifications}>{notifications}</span>
          )}
          {preferences && <span data-testid={AppHeaderTestId.Preferences}>{preferences}</span>}
        </div>
      </div>
    </header>
  );
}
