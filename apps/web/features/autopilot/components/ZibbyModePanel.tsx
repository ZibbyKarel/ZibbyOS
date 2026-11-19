"use client";

import {
  Button,
  Row,
  Stack,
  Typography,
  ZibbyOrb,
  ZibbyStatusAction,
  ZibbyStatusLink,
  ZibbyStatusMenu,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PauseError } from "../hooks/usePauseSwitch";

export enum ZibbyModePanelTestId {
  Pending = "zibby-mode-panel-pending",
  Levels = "zibby-mode-panel-levels",
  Error = "zibby-mode-panel-error",
  Unlock = "zibby-mode-panel-unlock",
}

export const AUTONOMY_HREF = "/governance/autonomy";
export const APPROVALS_HREF = "/activity/approvals";

export interface ZibbyModePanelProps {
  paused: boolean;
  /** A pause/resume request is running. */
  pending: boolean;
  error: PauseError;
  pendingApprovals: number;
  /** Names of the companies/teams that override something; empty = "no exceptions". */
  exceptions: string[];
  onToggle: () => void;
  /** Called after a link is followed, so the popover/sheet can close. */
  onNavigate: () => void;
  /** Bottom-sheet layout (phone). */
  sheet?: boolean;
}

/** Body of the status popover (desktop) and bottom sheet (phone): status, the pause switch, two links. */
export function ZibbyModePanel({
  paused,
  pending,
  error,
  pendingApprovals,
  exceptions,
  onToggle,
  onNavigate,
  sheet = false,
}: ZibbyModePanelProps) {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const go = (href: string) => {
    router.push(href as Route);
    onNavigate();
  };
  const key = paused ? "paused" : "run";
  return (
    <ZibbyStatusMenu
      description={t(`desc_${key}`)}
      orb={<ZibbyOrb size={52} state={paused ? "sleep" : "think"} />}
      orbLabel={t(`state_${key}`)}
      sheet={sheet}
      state={` · ${t(`state_${key}`)}`}
      status={key}
      title={t(`status_${key}`)}
    >
      <ZibbyStatusAction
        disabled={pending}
        hint={t(paused ? "resumeHint" : "pauseHint")}
        label={t(paused ? "resume" : "pause")}
        onClick={onToggle}
        resume={paused}
      />
      {error ? (
        <Row wrap align="center" data-testid={ZibbyModePanelTestId.Error} gap="100">
          <Typography size="xs" tone="bad" type="note">
            {error === "token" ? t("resumeNeedsToken") : t("failed")}
          </Typography>
          {error === "token" ? (
            <Button
              data-testid={ZibbyModePanelTestId.Unlock}
              intent="ghost"
              onClick={() => go(AUTONOMY_HREF)}
              size="sm"
            >
              {t("unlock")}
            </Button>
          ) : null}
        </Row>
      ) : null}
      <Stack gap="25">
        {pendingApprovals > 0 ? (
          <ZibbyStatusLink
            highlight
            data-testid={ZibbyModePanelTestId.Pending}
            icon="bell"
            label={t("pendingLink", { count: pendingApprovals })}
            onClick={() => go(APPROVALS_HREF)}
          />
        ) : null}
        <ZibbyStatusLink
          data-testid={ZibbyModePanelTestId.Levels}
          hint={
            exceptions.length > 0
              ? t("exceptionsList", { names: exceptions.join(", ") })
              : t("noExceptions")
          }
          icon="shield"
          label={t("levelsLink")}
          onClick={() => go(AUTONOMY_HREF)}
        />
      </Stack>
    </ZibbyStatusMenu>
  );
}
