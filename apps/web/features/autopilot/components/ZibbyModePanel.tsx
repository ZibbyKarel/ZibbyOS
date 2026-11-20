"use client";

import {
  Button,
  Row,
  Stack,
  StepSlider,
  TextInputField,
  Typography,
  ZibbyOrb,
  ZibbyStatusLink,
  ZibbyStatusMenu,
} from "@zibby/design-system";
import type { AutomationLevel } from "@zibby/contracts";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PauseError } from "../hooks/usePauseSwitch";
import type { SaveResult } from "../hooks/useSaveAutomation";
import { saveOperatorToken } from "../hooks/useHasOperatorToken";
import { LEVEL_ORB, PILL_ORB, pillKey, pillTone } from "../autonomy";

export enum ZibbyModePanelTestId {
  Pending = "zibby-mode-panel-pending",
  Levels = "zibby-mode-panel-levels",
  AutoError = "zibby-mode-panel-auto-error",
  TokenInput = "zibby-mode-panel-token-input",
  TokenSave = "zibby-mode-panel-token-save",
  Resume = "zibby-mode-panel-resume",
  ResumeError = "zibby-mode-panel-resume-error",
}

const LEVELS = ["manual", "semi", "auto"] as const;

export const AUTONOMY_HREF = "/governance/autonomy";
export const APPROVALS_HREF = "/activity/approvals";

export interface ZibbyModePanelProps {
  paused: boolean;
  pendingApprovals: number;
  /** Names of the companies/teams that override something; empty = "no exceptions". */
  exceptions: string[];
  /** The level every global capability shares; `null` = mixed. */
  level: AutomationLevel | null;
  /** Set every global capability to this level. */
  onSetLevel: (level: AutomationLevel) => void;
  /** Last result of that save; `locked` = raising needs the operator token. */
  autoResult: SaveResult | null;
  /** Lift the autonomy pause (needs the operator token: a 401 comes back as `resumeError: "token"`). */
  onResume: () => void;
  resumeError: PauseError;
  resumePending: boolean;
  /** Called after a link is followed, so the popover/sheet can close. */
  onNavigate: () => void;
  /** Bottom-sheet layout (phone). */
  sheet?: boolean;
}

/** Body of the status popover (desktop) and bottom sheet (phone): status, the autonomy slider, links. */
export function ZibbyModePanel({
  paused,
  pendingApprovals,
  exceptions,
  level,
  onSetLevel,
  autoResult,
  onNavigate,
  onResume,
  resumeError,
  resumePending,
  sheet = false,
}: ZibbyModePanelProps) {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const go = (href: string) => {
    router.push(href as Route);
    onNavigate();
  };
  const key = pillKey(paused, level);
  const [typed, setTyped] = useState("");
  const [wanted, setWanted] = useState<AutomationLevel | null>(null);
  const pick = (next: AutomationLevel) => {
    setWanted(next);
    onSetLevel(next);
  };
  return (
    <ZibbyStatusMenu
      description={t(`pillDesc_${key}`)}
      orb={<ZibbyOrb size={52} state={PILL_ORB[key]} />}
      orbLabel={t(`pill_${key}`)}
      sheet={sheet}
      state=""
      status={pillTone(key)}
      title={t(`pill_${key}`)}
    >
      <Stack gap="25">
        {paused ? (
          <Stack gap="50">
            <Button
              data-testid={ZibbyModePanelTestId.Resume}
              disabled={resumePending}
              icon="play"
              intent="primary"
              onClick={onResume}
            >
              {t("resumeAutonomy")}
            </Button>
            {resumeError ? (
              <Typography
                data-testid={ZibbyModePanelTestId.ResumeError}
                size="xs"
                tone="bad"
                type="note"
              >
                {resumeError === "token" ? t("resumeNeedsToken") : t("failed")}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
        <StepSlider
          ariaLabel={t("levelSliderLabel")}
          mixedLabel={t("levelMixed")}
          onChange={(v) => pick(v as AutomationLevel)}
          steps={LEVELS.map((l) => ({
            value: l,
            label: t(`levelStep_${l}`),
            icon: <ZibbyOrb size={26} state={LEVEL_ORB[l]} />,
          }))}
          value={level}
        />
        {autoResult === "locked" || autoResult === "failed" ? (
          <Typography data-testid={ZibbyModePanelTestId.AutoError} size="xs" tone="bad" type="note">
            {autoResult === "locked" ? t("saveLocked") : t("failed")}
          </Typography>
        ) : null}
        {autoResult === "locked" || resumeError === "token" ? (
          <Row align="center" gap="100">
            <TextInputField
              hideLabel
              autoComplete="off"
              data-testid={ZibbyModePanelTestId.TokenInput}
              label={t("operatorToken")}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="zby_op_…"
              type="password"
              value={typed}
            />
            <Button
              data-testid={ZibbyModePanelTestId.TokenSave}
              disabled={typed.trim() === ""}
              intent="primary"
              onClick={() => {
                saveOperatorToken(typed);
                setTyped("");
                if (resumeError === "token") onResume();
                else if (wanted) onSetLevel(wanted);
              }}
              size="sm"
            >
              {t("unlock")}
            </Button>
          </Row>
        ) : null}
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
