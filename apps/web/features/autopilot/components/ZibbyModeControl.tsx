"use client";

import {
  Sheet,
  ZibbyOrb,
  type ZibbyOrbState,
  ZibbySection,
  ZibbySectionOrbButton,
  ZibbySectionStatusButton,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { useChat } from "../../chat/ChatContext";
import { useCompaniesQuery } from "../../companies";
import { useProjectsQuery } from "../../projects";
import { useTeamsQuery } from "../../teams";
import { useZibbyLive } from "../../zibby/live/ZibbyLiveContext";
import { formatShortcut } from "../../zibby/shortcut/shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "../../zibby/shortcut/useZibbyShortcut";
import type { AutomationLevel } from "@zibby/contracts";
import {
  AUTOMATION_KEYS,
  PILL_ORB,
  buildScopes,
  exceptionsOf,
  pillKey,
  pillTone,
  sharedLevel,
} from "../autonomy";
import { usePauseSwitch } from "../hooks/usePauseSwitch";
import { type SaveResult, useSaveAutomation } from "../hooks/useSaveAutomation";
import { ModePopover } from "./ModePopover";
import { ZibbyModePanel } from "./ZibbyModePanel";

export enum ZibbyModeControlTestId {
  Root = "zibby-mode-control",
}

/** Shared state of every status control: the pause switch and who deviates from the defaults. */
function useStatusUi() {
  const sw = usePauseSwitch();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const { data: projects = [] } = useProjectsQuery();
  const exceptionNames = exceptionsOf(sw.automation, buildScopes(companies, teams, projects)).map(
    (s) => s.label,
  );
  const level = sharedLevel(sw.automation);
  const save = useSaveAutomation();
  const [autoResult, setAutoResult] = useState<SaveResult | null>(null);
  const setLevel = async (next: AutomationLevel) => {
    const global = { ...sw.automation.global };
    for (const k of AUTOMATION_KEYS) global[k] = next;
    setAutoResult(await save({ ...sw.automation, global }));
  };
  const panel = (sheet: boolean, close: () => void) => (
    <ZibbyModePanel
      autoResult={autoResult}
      exceptions={exceptionNames}
      level={level}
      onNavigate={close}
      onResume={() => sw.resume()}
      onSetLevel={(next) => void setLevel(next)}
      paused={sw.paused}
      pendingApprovals={sw.pendingApprovals}
      resumeError={sw.error}
      resumePending={sw.pending}
      sheet={sheet}
    />
  );
  return { sw, panel };
}

export interface ZibbyModeControlProps {
  /** `section`: desktop header (popover). `toolbar`: phone toolbar (bottom sheet). */
  variant?: "section" | "toolbar";
}

/**
 * The header's Zibby section: the orb button (opens Zibby) and the status button that opens the
 * status popover, or on the phone a bottom sheet. Zibby is always on: the pill never says it runs,
 * it names what Zibby may do on its own (Ručně / Poloautomat / Automat / Smíšené) or that autonomy
 * is paused. Tone: violet, amber with a speaking orb in full Automat (re-introduced by the operator
 * on 2026-11-19), grey with a sleeping orb while paused (pause wins over amber).
 */
export function ZibbyModeControl({ variant = "section" }: ZibbyModeControlProps) {
  const t = useTranslations("autopilot");
  const tz = useTranslations("zibby");
  const tc = useTranslations("common");
  const { sw, panel } = useStatusUi();
  const { dockOpen, open: openChat, setDockOpen } = useChat();
  const live = useZibbyLive();
  const { shortcut } = useZibbyShortcut();
  const platform = useShortcutPlatform();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const compact = variant === "toolbar";

  const key = pillKey(sw.paused, sharedLevel(sw.automation));
  const orbState: ZibbyOrbState = live.phase === "closed" ? PILL_ORB[key] : live.orbState;
  const statusAria = t("statusButtonAria", { status: t(`pill_${key}`) });

  return (
    <>
      <ZibbySection ariaLabel={tz("chip.label")} status={pillTone(key)}>
        <ZibbySectionOrbButton
          aria-label={tz("chip.aria", { shortcut: formatShortcut(shortcut, platform).join(" ") })}
          data-testid={ZibbyModeControlTestId.Root}
          onClick={() => (dockOpen ? setDockOpen(false) : openChat())}
          orb={<ZibbyOrb size={20} state={orbState} />}
        >
          {compact ? undefined : tz("chip.label")}
        </ZibbySectionOrbButton>
        {compact ? (
          <ZibbySectionStatusButton
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            aria-label={statusAria}
            label={t(`pill_${key}`)}
            onClick={() => setPopoverOpen(true)}
          />
        ) : (
          <ModePopover
            ariaLabel={t("statusMenuLabel")}
            onOpenChange={setPopoverOpen}
            open={popoverOpen}
            trigger={(props) => (
              <ZibbySectionStatusButton
                {...props}
                aria-label={statusAria}
                label={t(`pill_${key}`)}
                title={t(`pillDesc_${key}`)}
              />
            )}
          >
            {panel(false, () => setPopoverOpen(false))}
          </ModePopover>
        )}
      </ZibbySection>
      {compact ? (
        <Sheet
          ariaLabel={t("statusMenuLabel")}
          closeLabel={tc("close")}
          onClose={() => setPopoverOpen(false)}
          open={popoverOpen}
          side="bottom"
        >
          {panel(true, () => setPopoverOpen(false))}
        </Sheet>
      ) : null}
    </>
  );
}

export interface ZibbyModeChangeProps {
  /** The trigger, e.g. the "Pustit" link in the phone paused band. */
  renderTrigger: (open: () => void) => ReactNode;
}

/** Opens the status sheet without the toolbar section (the phone paused band's "Pustit"). */
export function ZibbyModeChange({ renderTrigger }: ZibbyModeChangeProps) {
  const t = useTranslations("autopilot");
  const tc = useTranslations("common");
  const { panel } = useStatusUi();
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  return (
    <>
      {renderTrigger(show)}
      <Sheet
        ariaLabel={t("statusMenuLabel")}
        closeLabel={tc("close")}
        onClose={() => setOpen(false)}
        open={open}
        side="bottom"
      >
        {panel(true, () => setOpen(false))}
      </Sheet>
    </>
  );
}
