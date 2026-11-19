"use client";
import { type ComponentType, type ReactNode, type Ref, useEffect, useState } from "react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

export enum SettingsLayoutTestId {
  Root = "settings-layout-root",
  Nav = "settings-layout-nav",
  NavItem = "settings-layout-nav-item",
  NavSelect = "settings-layout-nav-select",
  NavFooter = "settings-layout-nav-footer",
  Header = "settings-layout-header",
  Main = "settings-layout-main",
  Anchors = "settings-layout-anchors",
  Anchor = "settings-layout-anchor",
  AnchorSelect = "settings-layout-anchor-select",
}

export interface SettingsLayoutNavItem {
  id: string;
  href: string;
  label: string;
  icon?: IconName;
  active?: boolean;
  /** Right edge of the row: a version chip, an attention dot. */
  tail?: ReactNode;
}

export interface SettingsLayoutAnchor {
  id: string;
  label: string;
  /** Unsaved edits inside — ink dot. */
  dirty?: boolean;
  /** Needs attention — amber dot. */
  warn?: boolean;
}

export type SettingsLayoutLinkComponent = ComponentType<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode }
>;

export interface SettingsLayoutProps {
  navTitle: string;
  navLabel: string;
  nav: readonly SettingsLayoutNavItem[];
  /** Small text under the rail (version, host). */
  navFooter?: ReactNode;
  /** Router-agnostic navigation for the phone/narrow selects. */
  onNavigate: (href: string) => void;
  linkComponent?: SettingsLayoutLinkComponent;
  eyebrow: string;
  title: string;
  subtitle?: string;
  anchorsTitle: string;
  /** Page panels for the right "On this page" rail. Hidden below 4 entries (design `na` layout). */
  anchors: readonly SettingsLayoutAnchor[];
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

const DefaultLink: SettingsLayoutLinkComponent = ({ children, ...rest }) => (
  <a {...rest}>{children}</a>
);

const railTitle =
  "px-[10px] pt-[2px] pb-2 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase";
const selectClass =
  "h-[34px] w-full appearance-none rounded-[8px] border border-line-2 bg-bg px-3 pr-9 text-[13px] text-ink outline-none focus:border-ink-2";

function useActiveAnchor(ids: readonly string[]): [string | undefined, (id: string) => void] {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `ids`
  }, [key]);
  return [active, setActive];
}

/**
 * Settings page frame (design `Settings.dc.html`): a left page rail, the page header and
 * main column, and a right "On this page" anchor rail with unsaved / needs-attention marks.
 * Below 1100px the anchor rail folds into a select; below 700px the page rail does too.
 */
export function SettingsLayout({
  navTitle,
  navLabel,
  nav,
  navFooter,
  onNavigate,
  linkComponent: Link = DefaultLink,
  eyebrow,
  title,
  subtitle,
  anchorsTitle,
  anchors,
  children,
  ref,
}: SettingsLayoutProps) {
  const [active, setActive] = useActiveAnchor(anchors.map((a) => a.id));
  const showAnchors = anchors.length > 3;
  const current = nav.find((n) => n.active);
  return (
    <div
      className={cn(
        "mx-auto grid max-w-[1340px] grid-cols-1 items-start gap-5 px-4 pt-6",
        "min-[700px]:grid-cols-[192px_minmax(0,1fr)] min-[700px]:gap-7 min-[700px]:px-6",
        "min-[1100px]:gap-10 min-[1100px]:px-7 min-[1100px]:pt-7",
        showAnchors
          ? "min-[1100px]:grid-cols-[216px_minmax(0,1fr)_168px]"
          : "min-[1100px]:grid-cols-[216px_minmax(0,780px)_168px]",
      )}
      data-testid={SettingsLayoutTestId.Root}
      ref={ref}
    >
      <div className="relative min-[700px]:hidden">
        <div className={railTitle}>{navTitle}</div>
        <select
          aria-label={navLabel}
          className={cn(selectClass, "h-10 rounded-[10px] bg-panel text-[14px] font-medium")}
          data-testid={SettingsLayoutTestId.NavSelect}
          onChange={(e) => onNavigate(e.target.value)}
          value={current?.href}
        >
          {nav.map((n) => (
            <option key={n.id} value={n.href}>
              {n.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 bottom-[13px] text-ink-3">
          <Icon name="chevron" size="sm" />
        </span>
      </div>
      <nav
        aria-label={navLabel}
        className="sticky top-7 hidden flex-col gap-[2px] min-[700px]:flex"
        data-testid={SettingsLayoutTestId.Nav}
      >
        <div className={railTitle}>{navTitle}</div>
        {nav.map((n) => (
          <Link
            aria-current={n.active ? "page" : undefined}
            data-testid={SettingsLayoutTestId.NavItem}
            href={n.href}
            key={n.id}
          >
            <span
              className={cn(
                "flex min-h-[34px] items-center gap-[10px] rounded-[8px] px-[10px] py-[6px] text-[13px] leading-[1.3] text-ink-2 hover:bg-panel-2 hover:text-ink",
                focusRing,
                n.active &&
                  "bg-panel-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]",
              )}
            >
              {n.icon && (
                <span className={cn("inline-flex", n.active ? "text-ink" : "text-ink-3")}>
                  <Icon name={n.icon} size="sm" />
                </span>
              )}
              {n.label}
              {n.tail && <span className="ml-auto inline-flex">{n.tail}</span>}
            </span>
          </Link>
        ))}
        {navFooter && (
          <div
            className="mt-[14px] border-t border-line px-[10px] pt-3 text-[11.5px] leading-[1.6] text-ink-3"
            data-testid={SettingsLayoutTestId.NavFooter}
          >
            {navFooter}
          </div>
        )}
      </nav>

      <main className="flex min-w-0 flex-col gap-4 pb-12" data-testid={SettingsLayoutTestId.Main}>
        <header className="px-[2px] pb-1" data-testid={SettingsLayoutTestId.Header}>
          <div className="mb-[6px] text-[12px] text-ink-3">{eyebrow}</div>
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.025em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-[5px] text-[14px] text-pretty text-ink-2">{subtitle}</p>}
        </header>
        {showAnchors && (
          <div className="relative min-[1100px]:hidden">
            <select
              aria-label={anchorsTitle}
              className={selectClass}
              data-testid={SettingsLayoutTestId.AnchorSelect}
              onChange={(e) => {
                document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" });
              }}
              value=""
            >
              <option disabled value="">
                {anchorsTitle}
              </option>
              {anchors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.dirty ? " •" : ""}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 bottom-[10px] text-ink-3">
              <Icon name="chevron" size="sm" />
            </span>
          </div>
        )}
        {children}
      </main>

      {showAnchors && (
        <nav
          aria-label={anchorsTitle}
          className="sticky top-7 hidden flex-col border-l border-line min-[1100px]:flex"
          data-testid={SettingsLayoutTestId.Anchors}
        >
          <div className="px-3 pt-[2px] pb-2 text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase">
            {anchorsTitle}
          </div>
          {anchors.map((a) => {
            const on = a.id === active;
            return (
              <a
                aria-current={on ? "location" : undefined}
                className={cn(
                  "-ml-px flex items-center gap-[6px] border-l px-3 py-[5px] text-[12.5px] leading-[1.35] no-underline hover:text-ink",
                  focusRing,
                  on ? "border-ink font-medium text-ink" : "border-transparent text-ink-3",
                )}
                data-testid={SettingsLayoutTestId.Anchor}
                href={`#${a.id}`}
                key={a.id}
                onClick={() => setActive(a.id)}
              >
                {a.label}
                {a.dirty && (
                  <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-ink" />
                )}
                {a.warn && !a.dirty && (
                  <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-warn" />
                )}
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
