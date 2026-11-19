"use client";

import {
  Button,
  Sheet,
  ZibbyOrb,
  type ZibbyOrbState,
  ZibbySection,
  ZibbySectionModeButton,
  ZibbySectionOrbButton,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { useChat } from "../../chat/ChatContext";
import { useCompaniesQuery } from "../../companies";
import { useTeamsQuery } from "../../teams";
import { useZibbyLive } from "../../zibby/live/ZibbyLiveContext";
import { formatShortcut } from "../../zibby/shortcut/shortcut";
import { useShortcutPlatform, useZibbyShortcut } from "../../zibby/shortcut/useZibbyShortcut";
import { anyCapOn, buildScopes, exceptionsOf } from "../autonomy";
import { useHasOperatorToken } from "../hooks/useHasOperatorToken";
import { useModeSwitch } from "../hooks/useModeSwitch";
import { MODE_ORB } from "../modeMeta";
import { AutomatConfirmDialog } from "./AutomatConfirmDialog";
import { ModePopover } from "./ModePopover";
import { ZibbyModePanel } from "./ZibbyModePanel";

export enum ZibbyModeControlTestId {
  Root = "zibby-mode-control",
  Change = "zibby-mode-change",
  Sheet = "zibby-mode-sheet",
}

/** Shared state of every mode control: the switch, who deviates, and the confirm dialog. */
function useModeUi() {
  const sw = useModeSwitch();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const hasToken = useHasOperatorToken();
  const scopes = buildScopes(companies, teams);
  const exceptions = exceptionsOf(sw.automation, scopes);
  const dialog = (
    <AutomatConfirmDialog
      anyOn={anyCapOn(sw.automation)}
      error={sw.error}
      exceptions={exceptions}
      hasToken={hasToken}
      onCancel={sw.cancel}
      onConfirm={sw.confirm}
      open={sw.confirming}
      pending={sw.pending}
      pendingApprovals={sw.pendingApprovals}
    />
  );
  return { sw, exceptionNames: exceptions.map((e) => e.scope.label), dialog };
}

export interface ZibbyModeControlProps {
  /** `section`: desktop header (popover). `toolbar`: phone toolbar (bottom sheet). */
  variant?: "section" | "toolbar";
  /** Something waits on the operator: the closed orb turns `needs`. */
  needsAttention?: boolean;
}

/**
 * The header's Zibby section: the orb button (opens Zibby, like `ZibbyHeaderChip`) and the mode
 * button (Manuál / Poloautomat / Automat) that opens the mode popover, or on the phone a bottom
 * sheet. Replaces the old compass toggle and the `ZibbyHeaderChip` pill.
 */
export function ZibbyModeControl({
  variant = "section",
  needsAttention = false,
}: ZibbyModeControlProps) {
  const t = useTranslations("autopilot");
  const tz = useTranslations("zibby");
  const tc = useTranslations("common");
  const { sw, exceptionNames, dialog } = useModeUi();
  const { dockOpen, open: openChat, setDockOpen } = useChat();
  const live = useZibbyLive();
  const { shortcut } = useZibbyShortcut();
  const platform = useShortcutPlatform();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const compact = variant === "toolbar";

  const mode = sw.mode;
  const state = t(`modeState_${mode}`);
  const orbState: ZibbyOrbState =
    live.phase === "closed" ? (needsAttention ? "needs" : MODE_ORB[mode]) : live.orbState;
  const modeLabel = t(`mode_${mode}`);
  const modeAria = t("modeButtonAria", { mode: modeLabel, state: state.toLowerCase() });
  const body = (big: boolean, close: () => void) => (
    <ZibbyModePanel
      big={big}
      exceptions={exceptionNames}
      mode={mode}
      onNavigate={close}
      onSelect={(m) => {
        close();
        sw.select(m);
      }}
      pendingApprovals={sw.pendingApprovals}
    />
  );

  return (
    <>
      <ZibbySection ariaLabel={tz("chip.label")} mode={mode}>
        <ZibbySectionOrbButton
          aria-label={tz("chip.aria", { shortcut: formatShortcut(shortcut, platform).join(" ") })}
          data-testid={ZibbyModeControlTestId.Root}
          onClick={() => (dockOpen ? setDockOpen(false) : openChat())}
          orb={<ZibbyOrb size={20} state={orbState} />}
        >
          {compact ? undefined : tz("chip.label")}
        </ZibbySectionOrbButton>
        {compact ? (
          <ZibbySectionModeButton
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            aria-label={modeAria}
            label={modeLabel}
            mode={mode}
            onClick={() => setPopoverOpen(true)}
          />
        ) : (
          <ModePopover
            ariaLabel={t("zibbyModeLabel")}
            onOpenChange={setPopoverOpen}
            open={popoverOpen}
            trigger={(props) => (
              <ZibbySectionModeButton
                {...props}
                aria-label={modeAria}
                label={modeLabel}
                mode={mode}
                title={t(`modeDesc_${mode}`)}
              />
            )}
          >
            {body(false, () => setPopoverOpen(false))}
          </ModePopover>
        )}
      </ZibbySection>
      {compact ? (
        <Sheet
          ariaLabel={t("zibbyModeLabel")}
          closeLabel={tc("close")}
          onClose={() => setPopoverOpen(false)}
          open={popoverOpen}
          side="bottom"
        >
          {body(true, () => setPopoverOpen(false))}
        </Sheet>
      ) : null}
      {dialog}
    </>
  );
}

export interface ZibbyModeChangeProps {
  /** Replaces the default "Change" button (e.g. a link in the phone banner). */
  renderTrigger?: (open: () => void) => ReactNode;
}

/** The phone Automat banner's "Změnit": opens the same mode sheet without the toolbar section. */
export function ZibbyModeChange({ renderTrigger }: ZibbyModeChangeProps = {}) {
  const t = useTranslations("autopilot");
  const tc = useTranslations("common");
  const { sw, exceptionNames, dialog } = useModeUi();
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  return (
    <>
      {renderTrigger ? (
        renderTrigger(show)
      ) : (
        <Button data-testid={ZibbyModeControlTestId.Change} intent="ghost" onClick={show} size="sm">
          {t("change")}
        </Button>
      )}
      <Sheet
        ariaLabel={t("zibbyModeLabel")}
        closeLabel={tc("close")}
        onClose={() => setOpen(false)}
        open={open}
        side="bottom"
      >
        <ZibbyModePanel
          big
          exceptions={exceptionNames}
          mode={sw.mode}
          onNavigate={() => setOpen(false)}
          onSelect={(m) => {
            setOpen(false);
            sw.select(m);
          }}
          pendingApprovals={sw.pendingApprovals}
        />
      </Sheet>
      {dialog}
    </>
  );
}
