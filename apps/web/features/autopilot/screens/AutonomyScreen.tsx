"use client";

import type { AutopilotAutomation } from "@zibby/contracts";
import {
  Button,
  Container,
  Icon,
  Panel,
  Row,
  Stack,
  TextInputField,
  Typography,
  ZibbyOrb,
  ZibbyToast,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useCompaniesQuery } from "../../companies";
import { useTeamsQuery } from "../../teams";
import { AlwaysAskList } from "../components/AlwaysAskList";
import { AutonomyMatrix } from "../components/AutonomyMatrix";
import { buildScopes } from "../autonomy";
import { saveOperatorToken, useHasOperatorToken } from "../hooks/useHasOperatorToken";
import { usePauseSwitch } from "../hooks/usePauseSwitch";
import { useSaveAutomation } from "../hooks/useSaveAutomation";

export enum AutonomyScreenTestId {
  Root = "autonomy-screen",
  Unlock = "autonomy-unlock",
  UnlockInput = "autonomy-unlock-input",
  UnlockSave = "autonomy-unlock-save",
  Never = "autonomy-never",
  GatesLink = "autonomy-gates-link",
  Toast = "autonomy-toast",
  RunStatus = "autonomy-run-status",
  PauseToggle = "autonomy-pause-toggle",
  PausedBanner = "autonomy-paused-banner",
  PausedResume = "autonomy-paused-resume",
  PauseError = "autonomy-pause-error",
}

interface ToastState {
  message: string;
  undo?: () => void;
}

const TOAST_MS = 6000;

/**
 * `/governance/autonomy` - what Zibby may do on its own. The table edits the automation tree
 * (instant save, toast + undo); lowering never needs the operator token, raising does (a 401
 * toasts and the field below stores a token). The pause switch sits top right.
 */
export function AutonomyScreen() {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const hasToken = useHasOperatorToken();
  const save = useSaveAutomation();
  const sw = usePauseSwitch();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [typed, setTyped] = useState("");

  const automation: AutopilotAutomation = sw.automation;
  const scopes = buildScopes(companies, teams);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const persist = useCallback(
    async (next: AutopilotAutomation, message: string, undo?: () => void) => {
      setSaving(true);
      const result = await save(next);
      setSaving(false);
      setToast(
        result === "ok"
          ? { message, ...(undo ? { undo } : {}) }
          : { message: result === "locked" ? t("saveLocked") : t("failed") },
      );
    },
    [save, t],
  );
  const commit = useCallback(
    (next: AutopilotAutomation, message: string) => {
      const before = automation;
      return persist(next, message, () => void persist(before, t("undone")));
    },
    [automation, persist, t],
  );
  const flip = () =>
    sw.toggle((nowPaused) => setToast({ message: t(nowPaused ? "toastPaused" : "toastResumed") }));
  const key = sw.paused ? "paused" : "run";

  return (
    <Container data-testid={AutonomyScreenTestId.Root} padding={["300", "350"]}>
      <Stack gap="200">
        <Row wrap align="end" gap="300" justify="between">
          <Stack gap="50">
            <Typography type="h2">{t("pageTitle")}</Typography>
            <Typography type="text" variant="secondary">
              {t("pageIntro")}
            </Typography>
          </Stack>
          <Panel padding="100" radius="lg">
            <Row wrap align="center" gap="100">
              <ZibbyOrb size={16} state={sw.paused ? "sleep" : "think"} />
              <Typography data-testid={AutonomyScreenTestId.RunStatus} size="sm" type="text">
                {t("zibbyWord")} <b>{t(`status_${key}`)}</b>
              </Typography>
              <Button
                data-testid={AutonomyScreenTestId.PauseToggle}
                disabled={sw.pending}
                icon={sw.paused ? "play" : "pause"}
                intent={sw.paused ? "ink" : "secondary"}
                onClick={flip}
                size="sm"
              >
                {t(sw.paused ? "resumeShort" : "pauseShort")}
              </Button>
            </Row>
          </Panel>
        </Row>

        {sw.error ? (
          <Typography data-testid={AutonomyScreenTestId.PauseError} tone="bad" type="text">
            {sw.error === "token" ? t("resumeNeedsToken") : t("failed")}
          </Typography>
        ) : null}

        {sw.paused ? (
          <Panel padding="100" radius="lg">
            <Row
              align="center"
              data-testid={AutonomyScreenTestId.PausedBanner}
              gap="150"
              role="status"
            >
              <Icon name="pause" size="sm" />
              <Typography size="sm" type="text" variant="secondary">
                <b>{t("pausedBannerTitle")}</b> {t("pausedBannerBody")}
              </Typography>
              <Container grow />
              <Button
                data-testid={AutonomyScreenTestId.PausedResume}
                disabled={sw.pending}
                icon="play"
                intent="ink"
                onClick={flip}
                size="sm"
              >
                {t("resumeShort")}
              </Button>
            </Row>
          </Panel>
        ) : null}

        {!hasToken ? (
          <Panel padding="100">
            <Row wrap align="center" data-testid={AutonomyScreenTestId.Unlock} gap="100">
              <Icon name="lock" size="sm" />
              <Typography size="sm" type="text" variant="secondary">
                {t("unlockLine")}
              </Typography>
              <Container width="220px">
                <TextInputField
                  hideLabel
                  autoComplete="off"
                  data-testid={AutonomyScreenTestId.UnlockInput}
                  label={t("operatorToken")}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="zby_op_…"
                  type="password"
                  value={typed}
                />
              </Container>
              <Button
                data-testid={AutonomyScreenTestId.UnlockSave}
                disabled={typed.trim() === ""}
                intent="primary"
                onClick={() => {
                  saveOperatorToken(typed);
                  setTyped("");
                }}
                size="sm"
              >
                {t("unlock")}
              </Button>
            </Row>
          </Panel>
        ) : null}

        <AutonomyMatrix
          automation={automation}
          onChange={(next, message) => {
            if (!saving) void commit(next, message);
          }}
          paused={sw.paused}
          scopes={scopes}
        />

        <Panel padding="150">
          <Row wrap align="center" data-testid={AutonomyScreenTestId.Never} gap="100">
            <Icon name="lock" size="sm" />
            <Typography type="label">{t("alwaysAsks")}</Typography>
            <AlwaysAskList />
            <Container grow />
            <Button
              data-testid={AutonomyScreenTestId.GatesLink}
              intent="ghost"
              onClick={() => router.push("/governance/gates" as Route)}
              size="sm"
            >
              {t("gatesLink")}
            </Button>
          </Row>
        </Panel>
      </Stack>

      {toast ? (
        <Container
          bottom="24px"
          left="0"
          pointerEvents="none"
          position="fixed"
          right="0"
          zIndex={60}
        >
          <Row justify="center">
            <Container pointerEvents="auto">
              <div data-testid={AutonomyScreenTestId.Toast}>
                <ZibbyToast
                  actionLabel={toast.undo ? t("undo") : undefined}
                  message={toast.message}
                  onAction={
                    toast.undo
                      ? () => {
                          toast.undo?.();
                          setToast(null);
                        }
                      : undefined
                  }
                />
              </div>
            </Container>
          </Row>
        </Container>
      ) : null}
    </Container>
  );
}
