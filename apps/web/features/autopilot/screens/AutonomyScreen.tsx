"use client";

import {
  Button,
  Container,
  Icon,
  Panel,
  Row,
  SegmentedControl,
  Stack,
  TextInputField,
  Typography,
  type ZibbyMode,
  ZibbyOrb,
  ZibbyToast,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useCompaniesQuery } from "../../companies";
import { useTeamsQuery } from "../../teams";
import type { AutopilotAutomation } from "@zibby/contracts";
import { AutomatConfirmDialog, NeverList } from "../components/AutomatConfirmDialog";
import { AutonomyMatrix } from "../components/AutonomyMatrix";
import { EMPTY_AUTOMATION, anyCapOn, buildScopes, exceptionsOf } from "../autonomy";
import { saveOperatorToken, useHasOperatorToken } from "../hooks/useHasOperatorToken";
import { useModeSwitch } from "../hooks/useModeSwitch";
import { useSaveAutomation } from "../hooks/useSaveAutomation";
import { MODES, MODE_ORB, MODE_TONE } from "../modeMeta";
import { useAutopilotQuery } from "../queries";

export enum AutonomyScreenTestId {
  Root = "autonomy-screen",
  Unlock = "autonomy-unlock",
  UnlockInput = "autonomy-unlock-input",
  UnlockSave = "autonomy-unlock-save",
  Never = "autonomy-never",
  Toast = "autonomy-toast",
}

interface ToastState {
  message: string;
  undo?: () => void;
}

const TOAST_MS = 6000;

/**
 * `/governance/autonomy` - who may do what on its own. The matrix edits the automation tree
 * (instant save, toast + undo); every write needs the operator token, so without one it is
 * read-only with a prompt to unlock. Level and Výchozí rules are unchanged (see
 * `docs/api/autopilot.md`): Poloautomat = `off`/false, Automat = `full`/true.
 */
export function AutonomyScreen() {
  const t = useTranslations("autopilot");
  const { data } = useAutopilotQuery();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const hasToken = useHasOperatorToken();
  const save = useSaveAutomation();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [typed, setTyped] = useState("");
  const sw = useModeSwitch((m) =>
    setToast({ message: t("modeChanged", { mode: t(`mode_${m}`) }) }),
  );

  const automation: AutopilotAutomation = data?.automation ?? EMPTY_AUTOMATION;
  const scopes = buildScopes(companies, teams);
  const editable = hasToken && !saving && data !== undefined;
  const autoCapped = sw.mode !== "auto";

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const persist = useCallback(
    async (next: AutopilotAutomation, message: string, focusId?: string, undo?: () => void) => {
      setSaving(true);
      const result = await save(next);
      setSaving(false);
      if (result === "ok") {
        setToast({ message, ...(undo ? { undo } : {}) });
        if (focusId)
          window.requestAnimationFrame(() =>
            document.querySelector<HTMLElement>(`[data-chip="${focusId}"]`)?.focus(),
          );
      } else {
        setToast({ message: result === "locked" ? t("saveLocked") : t("failed") });
      }
    },
    [save, t],
  );
  const commit = useCallback(
    (next: AutopilotAutomation, message: string, focusId?: string) => {
      const before = automation;
      return persist(next, message, focusId, () => void persist(before, t("undone"), focusId));
    },
    [automation, persist, t],
  );

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
              <Typography size="sm" type="text" variant="secondary">
                {t("zibbyModeLabel")}
              </Typography>
              <SegmentedControl
                ariaLabel={t("zibbyModeLabel")}
                items={MODES.map((m) => ({
                  value: m,
                  label: t(`mode_${m}`),
                  leading: <ZibbyOrb size={14} state={MODE_ORB[m]} />,
                  tone: MODE_TONE[m] === "neutral" ? undefined : MODE_TONE[m],
                  disabled: m === "manual",
                }))}
                onChange={(m) => sw.select(m as ZibbyMode)}
                value={sw.mode}
              />
            </Row>
          </Panel>
        </Row>

        {!hasToken ? (
          <Panel padding="100">
            <Row wrap align="center" data-testid={AutonomyScreenTestId.Unlock} gap="100">
              <Icon name="lock" size="sm" />
              <Typography size="sm" type="text" variant="secondary">
                {t("readOnlyLine")}
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
          autoCapped={autoCapped}
          automation={automation}
          editable={editable}
          onChange={(next, message, focusId) => void commit(next, message, focusId)}
          scopes={scopes}
        />

        <Panel padding="150">
          <Row wrap align="center" data-testid={AutonomyScreenTestId.Never} gap="100">
            <Icon name="lock" size="sm" />
            <Typography type="label">{t("alwaysAsksEveryMode")}</Typography>
            <NeverList />
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

      <AutomatConfirmDialog
        anyOn={anyCapOn(automation)}
        error={sw.error}
        exceptions={exceptionsOf(automation, scopes)}
        hasToken={hasToken}
        onCancel={sw.cancel}
        onConfirm={sw.confirm}
        open={sw.confirming}
        pending={sw.pending}
        pendingApprovals={sw.pendingApprovals}
      />
    </Container>
  );
}
