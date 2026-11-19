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
import type { SaveResult } from "../hooks/useSaveAutomation";
import { saveOperatorToken } from "../hooks/useHasOperatorToken";
import { LEVEL_ORB, STATUS_ORB } from "../autonomy";

export enum ZibbyModePanelTestId {
  Pending = "zibby-mode-panel-pending",
  Levels = "zibby-mode-panel-levels",
  AutoError = "zibby-mode-panel-auto-error",
  TokenInput = "zibby-mode-panel-token-input",
  TokenSave = "zibby-mode-panel-token-save",
  Paused = "zibby-mode-panel-paused",
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
  sheet = false,
}: ZibbyModePanelProps) {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const go = (href: string) => {
    router.push(href as Route);
    onNavigate();
  };
  const key = paused ? "paused" : level === "auto" ? "auto" : "run";
  const [typed, setTyped] = useState("");
  const [wanted, setWanted] = useState<AutomationLevel | null>(null);
  const pick = (next: AutomationLevel) => {
    setWanted(next);
    onSetLevel(next);
  };
  return (
    <ZibbyStatusMenu
      description={t(`desc_${key}`)}
      orb={<ZibbyOrb size={52} state={STATUS_ORB[key]} />}
      orbLabel={t(`state_${key}`)}
      sheet={sheet}
      state={` · ${t(`state_${key}`)}`}
      status={key}
      title={t(`status_${key}`)}
    >
      <Stack gap="25">
        {paused ? (
          <ZibbyStatusLink
            data-testid={ZibbyModePanelTestId.Paused}
            hint={t("desc_paused")}
            icon="pause"
            label={t("status_paused")}
            onClick={() => go(AUTONOMY_HREF)}
          />
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
          <Stack gap="50">
            <Typography
              data-testid={ZibbyModePanelTestId.AutoError}
              size="xs"
              tone="bad"
              type="note"
            >
              {autoResult === "locked" ? t("saveLocked") : t("failed")}
            </Typography>
            {autoResult === "locked" ? (
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
                    if (wanted) onSetLevel(wanted);
                  }}
                  size="sm"
                >
                  {t("unlock")}
                </Button>
              </Row>
            ) : null}
          </Stack>
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
