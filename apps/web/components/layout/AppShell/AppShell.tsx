"use client";

import { type ReactNode, Suspense, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AppFrame,
  AppHeader,
  BrandMark,
  type BrandMarkState,
  Button,
  HeaderModeGroup,
  MobileMenu,
  MobileToolbar,
  SectionTrack,
  Stack,
  SubNav,
} from "@zibby/design-system";
import { CatalogProvider } from "../../../state/store";
import { NewTaskProvider, useNewTaskPageHotkey } from "../../../features/tasks";
import { NoteDock } from "../../../features/knowledge/components/NoteDock";
import { OpenNoteDockProvider } from "../../../features/knowledge/noteDockContext";
import { ChatProvider, useChat } from "../../../features/chat";
import { ZibbyHost, ZibbyLiveProvider } from "../../../features/zibby";
import { CommandPaletteHost, useCommandPaletteHotkey } from "../../../features/command-palette";
import { ApprovalSheet } from "../../../features/approvals/components/ApprovalSheet";
import { useApprovalSheetParam } from "../../../features/approvals/useApprovalSheetParam";
import { counterSuffix } from "../../../features/inbox/inbox";
import { useInboxCounts } from "../../../features/inbox/useInboxCounts";
import { useApprovalsQuery } from "../../../features/approvals/queries";
import { useRunsQuery } from "../../../features/runs/queries";
import { useIsPhone } from "../../../hooks/useIsPhone";
import { NotificationBell } from "../../../features/notifications";
import {
  ApprovalNotifier,
  ZibbyModeChange,
  ZibbyModeControl,
  useAutopilotQuery,
} from "../../../features/autopilot";
import {
  PinPageDialog,
  SubnavPinButton,
  type SubnavPinEntityKind,
  pinHrefFor,
  usePagePins,
} from "../../../features/pins";
import { SettingsCrumbBar } from "../../../features/settings/components/SettingsCrumbBar";
import { AiEngineSwitcher } from "../AiEngineSwitcher/AiEngineSwitcher";
import { PageActionsSlotProvider } from "../PageActions";
import { PageBreadcrumbSlotProvider } from "../PageBreadcrumb";
import { NewMenu, PreferencesMenu } from "./HeaderControls";
import { NavLink } from "./NavLink";
import { type HeaderCollapseLevel, useHeaderCollapse } from "./useHeaderCollapse";
import { SECTIONS, type SectionId, type SubTabConfig, sectionForPath } from "../../../state/config";

export enum AppShellTestId {
  PinToggle = "app-shell-pin-toggle",
  PageActions = "app-shell-page-actions",
}

/** `/<kind>/<id>` (and its sub-tabs) — a company/project/team detail
 *  page, never its `/new` creation screen (spec step 5). */
function matchEntityDetail(
  pathname: string,
): { kind: SubnavPinEntityKind; id: string; href: string } | null {
  const match = /^\/(companies|projects|teams)\/([^/]+)/.exec(pathname);
  if (!match) return null;
  const [, kind, id] = match as unknown as [string, SubnavPinEntityKind, string];
  if (!id || id === "new") return null;
  return { kind, id, href: `/${kind}/${id}` };
}

/**
 * The section nav (`AppHeader`'s `nav` slot) — a `SectionTrack` of links. Each section's `href`
 * is today's closest existing route (`SECTIONS`, ZB-01); the dashboard carries an amber dot while
 * something waits for the operator.
 */
function SectionNav({
  active,
  attention,
  iconOnlyInactive,
}: {
  active: SectionId;
  attention: boolean;
  /** Narrow header: only the active section keeps its label. */
  iconOnlyInactive: boolean;
}) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  return (
    <SectionTrack
      ariaLabel={tShell("sectionsAria")}
      // Settings is not a top-bar section: the preferences (gear) menu is its only entry.
      items={SECTIONS.filter((section) => section.id !== "system").map((section) => ({
        href: section.href,
        label: t(section.id),
        icon: section.glyph,
        active: section.id === active,
        attention: attention && section.id === "dashboard",
        iconOnly: iconOnlyInactive && section.id !== active,
      }))}
      linkComponent={NavLink}
    />
  );
}

/** The sub-nav tab owning `pathname`: the longest `matchPrefix ?? href` it equals
 *  or prefixes (so a detail page like `/projects/x` keeps `/projects`
 *  active). Returns the tab and the prefix that matched. */
function activeSubNavTab<T extends { href: string; matchPrefix?: string }>(
  tabs: readonly T[],
  pathname: string,
): { tab: T; prefix: string } | null {
  let best: { tab: T; prefix: string } | null = null;
  for (const tab of tabs) {
    const prefix = tab.matchPrefix ?? tab.href;
    if (
      (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
      prefix.length > (best?.prefix.length ?? -1)
    ) {
      best = { tab, prefix };
    }
  }
  return best;
}

function activeSubNavHref(
  tabs: readonly { href: string; matchPrefix?: string }[],
  pathname: string,
): string | null {
  return activeSubNavTab(tabs, pathname)?.tab.href ?? null;
}

/** Sub-nav page-pin toggle — pins unpinned pages via `PinPageDialog`
 *  (`onPinRequested`), unpins immediately. */
function PagePinToggle({
  currentHref,
  onPinRequested,
}: {
  currentHref: string;
  onPinRequested: () => void;
}) {
  const t = useTranslations("shell");
  const { isPagePinned, unpinPage } = usePagePins();
  const pinned = isPagePinned(currentHref);
  return (
    <Button
      aria-label={t(pinned ? "pageUnpinAria" : "pagePinAria")}
      aria-pressed={pinned}
      data-testid={AppShellTestId.PinToggle}
      icon="pin"
      intent={pinned ? "secondary" : "ghost"}
      onClick={() => (pinned ? unpinPage(currentHref) : onPinRequested())}
      size="sm"
    />
  );
}

/** Page-pin control: a company/project/team detail page (never /new) gets the
 *  entity "+ PIN"/"PINNED" toggle (spec step 5), every other page the page toggle. */
function PinControl({
  pathname,
  currentHref,
  onPinRequested,
}: {
  pathname: string;
  currentHref: string;
  onPinRequested: () => void;
}) {
  // The Bridge (`/dashboard`, the "Můstek" tab) is not pinnable.
  if (pathname === "/dashboard") return null;
  const entity = matchEntityDetail(pathname);
  return entity ? (
    <SubnavPinButton href={entity.href} id={entity.id} key={entity.href} kind={entity.kind} />
  ) : (
    <PagePinToggle currentHref={currentHref} onPinRequested={onPinRequested} />
  );
}

function SectionSubNav({
  active,
  trail,
  pageActions,
  currentHref,
  onPinRequested,
}: {
  active: SectionId;
  /** The page-breadcrumb portal target, rendered after the tabs. */
  trail: ReactNode;
  /** The page-actions portal target, rendered first in the actions slot. */
  pageActions: ReactNode;
  currentHref: string;
  onPinRequested: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];
  const activeHref = activeSubNavHref(section.tabs, pathname);
  // Inbox counters (global, actionable only) ride in the tab's count pill, amber while they
  // need the operator. Only fetched while the Dashboard section is open.
  const inboxCounts = useInboxCounts(active === "dashboard");
  const items = section.tabs.map((tab) => {
    const count =
      active === "dashboard" ? counterSuffix(tab.id, inboxCounts).replace(/^ · /, "") : "";
    const waiting = count !== "";
    return {
      href: tab.href,
      icon: "icon" in tab ? tab.icon : undefined,
      label: t(`subtab.${section.id}.${tab.id}` as Parameters<typeof t>[0]),
      active: tab.href === activeHref,
      count: count || undefined,
      countTone: waiting ? ("attention" as const) : ("default" as const),
    };
  });
  return (
    <SubNav
      actions={
        <>
          {pageActions}
          <PinControl
            currentHref={currentHref}
            onPinRequested={onPinRequested}
            pathname={pathname}
          />
        </>
      }
      items={items}
      linkComponent={NavLink}
      trail={trail}
    />
  );
}

/** Phone navigation: the whole section/sub-page tree in a hamburger sheet. */
function PhoneMenu({ pathname }: { pathname: string }) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const activeId = sectionForPath(pathname);
  const sections = SECTIONS.map((section) => {
    const isActive = section.id === activeId;
    const activeHref = isActive ? activeSubNavHref(section.tabs, pathname) : null;
    return {
      id: section.id,
      label: t(section.id),
      href: section.href,
      active: isActive,
      items: section.tabs.map((tab) => ({
        href: tab.href,
        label: t(`subtab.${section.id}.${tab.id}` as Parameters<typeof t>[0]),
        active: tab.href === activeHref,
      })),
    };
  });
  return (
    <MobileMenu
      closeLabel={tShell("menuClose")}
      label={tShell("menu")}
      linkComponent={NavLink}
      sections={sections}
    />
  );
}

/** Live system state feeding the header: the brand knot. */
function useHeaderTrailing() {
  const { data: approvals } = useApprovalsQuery();
  const { runs } = useRunsQuery();
  // System state for the status block and phone brand mark (the desktop logo is static).
  const markState: BrandMarkState =
    approvals?.length || runs.some((r) => r.status === "awaiting-approval" || r.status === "parked")
      ? "blocked"
      : runs.some((r) => r.status === "running")
        ? "working"
        : "idle";

  return {
    markState,
  };
}

function AppShellChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const tShell = useTranslations("shell");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const { data: autopilot } = useAutopilotQuery();
  const paused = autopilot?.paused === true;
  const phone = useIsPhone();
  const searchParams = useSearchParams();
  const active = sectionForPath(pathname);
  const trailing = useHeaderTrailing();
  const { ref: headerRef, level } = useHeaderCollapse(trailing.markState);
  const lv: HeaderCollapseLevel = level;
  const needsAttention = trailing.markState === "blocked";
  const approvalSheet = useApprovalSheetParam();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const { setDockOpen } = useChat();
  const [noteOpen, setNoteOpen] = useState(false);
  const [crumbSlot, setCrumbSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const activeTab = activeSubNavTab<SubTabConfig>(
    SECTIONS.find((s) => s.id === active)?.tabs ?? [],
    pathname,
  );
  // A first crumb equal to the tab's href or its prefix just repeats the tab.
  const activeSubHrefs = activeTab ? [activeTab.tab.href, activeTab.prefix] : [];
  useCommandPaletteHotkey(() => setPaletteOpen((o) => !o));
  useNewTaskPageHotkey();

  const currentHref = pinHrefFor(pathname, searchParams.toString());
  const onPinRequested = () => setPinDialogOpen(true);
  const openNote = () => {
    // Close Zibby so its mic turns off and its Esc listener does not also close the note.
    setDockOpen(false);
    setNoteOpen(true);
  };
  // `display: contents` — the portalled controls join the actions row's own flex
  // gap; an empty slot takes no room. The slot lives in the sub-nav (desktop) or
  // the sub-nav row on both desktop and phone.
  const pageActions = (
    <Stack
      data-testid={AppShellTestId.PageActions}
      ref={setActionsSlot}
      style={{ display: "contents" }}
    />
  );

  return (
    <PageBreadcrumbSlotProvider activeHrefs={activeSubHrefs} element={crumbSlot}>
      <PageActionsSlotProvider element={actionsSlot}>
        <OpenNoteDockProvider value={openNote}>
          <AppFrame
            dock={
              <>
                <NoteDock onClose={() => setNoteOpen(false)} open={noteOpen} />
                {/* Zibby: the overlay assistant (full screen, summoned from anywhere). It owns the
                  chat engine — mounted exactly once, so the app keeps a single SSE stream. */}
                <ZibbyHost />
              </>
            }
            fullBleed={pathname === "/dashboard"}
            header={
              phone ? (
                <MobileToolbar
                  actions={
                    <>
                      <ZibbyModeControl variant="toolbar" />
                      <NewMenu iconOnly onNewNote={openNote} />
                      <NotificationBell />
                    </>
                  }
                  banner={
                    paused
                      ? tShell.rich("pausedBanner", { b: (chunks) => <b>{chunks}</b> })
                      : undefined
                  }
                  bannerAction={
                    paused ? (
                      <ZibbyModeChange
                        renderTrigger={(begin) => (
                          <Button intent="ghost" onClick={begin} size="sm">
                            {tShell("pausedBannerAction")}
                          </Button>
                        )}
                      />
                    ) : undefined
                  }
                  brand={
                    <NavLink aria-label="ZibbyOS" href="/dashboard">
                      <BrandMark live state={trailing.markState} />
                    </NavLink>
                  }
                  leading={<PhoneMenu pathname={pathname} />}
                  title={tNav(active)}
                />
              ) : (
                <AppHeader
                  create={<NewMenu iconOnly={lv >= 2} onNewNote={openNote} />}
                  hideWordmark={lv >= 1}
                  homeHref="/dashboard"
                  linkComponent={NavLink}
                  mode={
                    <HeaderModeGroup ariaLabel={tShell("modeGroupAria")}>
                      <AiEngineSwitcher compact={lv >= 2} />
                    </HeaderModeGroup>
                  }
                  nav={
                    <SectionNav
                      active={active}
                      attention={needsAttention}
                      iconOnlyInactive={lv >= 2}
                    />
                  }
                  notifications={<NotificationBell />}
                  onSearchClick={() => setPaletteOpen(true)}
                  preferences={<PreferencesMenu />}
                  ref={headerRef}
                  searchCompact={lv >= 1}
                  searchLabel={tShell("search")}
                  zibby={<ZibbyModeControl />}
                />
              )
            }
            skipLinkLabel={t("skipToContent")}
            subnav={
              pathname.startsWith("/system/settings") ? (
                <SettingsCrumbBar />
              ) : (
                <SectionSubNav
                  active={active}
                  currentHref={currentHref}
                  onPinRequested={onPinRequested}
                  pageActions={pageActions}
                  trail={<div ref={setCrumbSlot} />}
                />
              )
            }
          >
            {children}
            <ApprovalSheet approvalId={approvalSheet.approvalId} onClose={approvalSheet.close} />
            <CommandPaletteHost
              onOpenApproval={approvalSheet.open}
              onOpenChange={setPaletteOpen}
              open={paletteOpen}
            />
            {pinDialogOpen && (
              <PinPageDialog href={currentHref} onClose={() => setPinDialogOpen(false)} />
            )}
          </AppFrame>
        </OpenNoteDockProvider>
      </PageActionsSlotProvider>
    </PageBreadcrumbSlotProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CatalogProvider>
      {/* NewTaskProvider stays the outer provider — see `SectionSubNav`'s
          "+ NEW TASK" action and the retired HUD's own doc history. */}
      <NewTaskProvider>
        <ChatProvider>
          <ZibbyLiveProvider>
            <ApprovalNotifier />
            <Suspense>
              <AppShellChrome>{children}</AppShellChrome>
            </Suspense>
          </ZibbyLiveProvider>
        </ChatProvider>
      </NewTaskProvider>
    </CatalogProvider>
  );
}
