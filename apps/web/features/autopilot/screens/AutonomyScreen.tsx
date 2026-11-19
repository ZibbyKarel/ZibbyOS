"use client";

import {
  Button,
  Chip,
  Container,
  Grid,
  Panel,
  Row,
  Stack,
  TextInputField,
  Typography,
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
import { ZibbyModeCards } from "../components/ZibbyModeCards";
import { EMPTY_AUTOMATION, LANES, anyCapOn, buildScopes, exceptionsOf } from "../autonomy";
import { saveOperatorToken, useHasOperatorToken } from "../hooks/useHasOperatorToken";
import { useModeSwitch } from "../hooks/useModeSwitch";
import { useSaveAutomation } from "../hooks/useSaveAutomation";
import { MODE_ORB } from "../modeMeta";
import { useAutopilotQuery } from "../queries";

export enum AutonomyScreenTestId {
  Root = "autonomy-screen",
  Unlock = "autonomy-unlock",
  UnlockInput = "autonomy-unlock-input",
  UnlockSave = "autonomy-unlock-save",
  Lane = "autonomy-lane-head",
  CapNote = "autonomy-cap-note",
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
          <Container width="380px">
            <ZibbyModeCards mode={sw.mode} onSelect={sw.select} />
          </Container>
        </Row>

        {!hasToken ? (
          <Panel padding="200">
            <Stack data-testid={AutonomyScreenTestId.Unlock} gap="100">
              <Typography type="label">{t("readOnlyTitle")}</Typography>
              <Typography size="sm" type="text" variant="secondary">
                {t("readOnlyHint")}
              </Typography>
              <Row align="end" gap="100">
                <TextInputField
                  autoComplete="off"
                  data-testid={AutonomyScreenTestId.UnlockInput}
                  label={t("operatorToken")}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="zby_op_…"
                  type="password"
                  value={typed}
                />
                <Button
                  data-testid={AutonomyScreenTestId.UnlockSave}
                  disabled={typed.trim() === ""}
                  intent="primary"
                  onClick={() => {
                    saveOperatorToken(typed);
                    setTyped("");
                  }}
                >
                  {t("unlock")}
                </Button>
              </Row>
            </Stack>
          </Panel>
        ) : null}

        <Grid cols={3} gap="100">
          {LANES.map((lane) => (
            <Stack data-testid={`${AutonomyScreenTestId.Lane}-${lane}`} gap="25" key={lane}>
              <Row gap="75">
                <ZibbyOrb size={24} state={MODE_ORB[lane]} />
                <Typography type="label">{t(`mode_${lane}`)}</Typography>
              </Row>
              <Typography size="xs" type="note" variant="tertiary">
                {t(`lane_${lane}`)}
              </Typography>
              {lane === "auto" && autoCapped ? (
                <Row>
                  <Chip data-testid={AutonomyScreenTestId.CapNote}>{t("cappedNote")}</Chip>
                </Row>
              ) : null}
            </Stack>
          ))}
        </Grid>

        <AutonomyMatrix
          autoCapped={autoCapped}
          automation={automation}
          editable={editable}
          onChange={(next, message, focusId) => void commit(next, message, focusId)}
          scopes={scopes}
        />

        <Panel padding="150">
          <Stack data-testid={AutonomyScreenTestId.Never} gap="100">
            <Typography type="label">{t("alwaysAsksEveryMode")}</Typography>
            <NeverList />
          </Stack>
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
