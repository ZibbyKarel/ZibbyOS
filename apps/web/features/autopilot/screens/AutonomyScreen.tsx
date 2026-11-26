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
  ZibbyToast,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useCompaniesQuery } from "../../companies";
import { useProjectsQuery } from "../../projects";
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
}

interface ToastState {
  message: string;
  undo?: () => void;
}

const TOAST_MS = 6000;

/**
 * `/governance/autonomy` - what Zibby may do on its own. The table edits the automation tree
 * (instant save, toast + undo); lowering never needs the operator token, raising does (a 401
 * toasts and the field below stores a token).
 */
export function AutonomyScreen() {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: teams = [] } = useTeamsQuery();
  const { data: projects = [] } = useProjectsQuery();
  const hasToken = useHasOperatorToken();
  const save = useSaveAutomation();
  const sw = usePauseSwitch();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [typed, setTyped] = useState("");

  const automation: AutopilotAutomation = sw.automation;
  const scopes = buildScopes(companies, teams, projects);

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
        </Row>

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
