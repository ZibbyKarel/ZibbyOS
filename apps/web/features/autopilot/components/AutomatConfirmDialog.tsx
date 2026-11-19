"use client";

import {
  Button,
  Chip,
  Container,
  Dialog,
  Icon,
  Row,
  Stack,
  TextInputField,
  Typography,
  ZibbyOrb,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ConfirmError } from "../hooks/useModeSwitch";
import { type ScopeException } from "../autonomy";

export enum AutomatConfirmTestId {
  Confirm = "automat-confirm-submit",
  Cancel = "automat-confirm-cancel",
  Token = "automat-confirm-token",
  TokenVerified = "automat-confirm-token-verified",
  Error = "automat-confirm-error",
  Never = "automat-confirm-never",
  Exceptions = "automat-confirm-exceptions",
  NothingOn = "automat-confirm-nothing-on",
}

/** Static copy keys of the "always asks" list (hard rules: never auto-merge / deploy / pay / delete ...). */
export const NEVER_KEYS = [
  "neverMerge",
  "neverDeploy",
  "neverPayments",
  "neverDelete",
  "neverForcePush",
  "neverSharedPush",
  "neverEmail",
  "neverPr",
  "neverJira",
] as const;

/** The "Vždy se zeptá" chip list, shared by the dialog and the page footer. */
export function NeverList() {
  const t = useTranslations("autopilot");
  return (
    <Row wrap gap="50">
      {NEVER_KEYS.map((k) => (
        <Chip key={k}>{t(k)}</Chip>
      ))}
    </Row>
  );
}

export interface AutomatConfirmDialogProps {
  open: boolean;
  exceptions: ScopeException[];
  pendingApprovals: number;
  /** Some company/team has a capability on; without one Automat would do nothing. */
  anyOn: boolean;
  hasToken: boolean;
  pending: boolean;
  error: ConfirmError;
  onCancel: () => void;
  /** `typedToken` is set when the field was filled. */
  onConfirm: (typedToken?: string) => void;
}

/**
 * "Switch Zibby to Automat?" — what stays an exception, what always asks, and the operator token
 * (a field, or a "token set" row when this browser already holds one; the web cannot verify it,
 * a 401 brings the field back). Enter is disabled until a token is available.
 */
export function AutomatConfirmDialog({
  open,
  exceptions,
  pendingApprovals,
  anyOn,
  hasToken,
  pending,
  error,
  onCancel,
  onConfirm,
}: AutomatConfirmDialogProps) {
  const t = useTranslations("autopilot");
  const tc = useTranslations("common");
  const [typed, setTyped] = useState("");
  const [replace, setReplace] = useState(false);
  const showField = !hasToken || replace || error === "token";
  const typedToken = showField ? typed.trim() : "";
  const ready = anyOn && (hasToken && !showField ? true : typedToken !== "");
  const close = () => {
    setTyped("");
    setReplace(false);
    onCancel();
  };
  return (
    <Dialog
      actions={
        <>
          <Button data-testid={AutomatConfirmTestId.Cancel} intent="ghost" onClick={close}>
            {tc("cancel")}
          </Button>
          <Button
            data-testid={AutomatConfirmTestId.Confirm}
            disabled={!ready}
            intent="primary"
            loading={pending}
            onClick={() => onConfirm(typedToken || undefined)}
          >
            {t("switchToAuto")}
          </Button>
        </>
      }
      ariaLabel={t("confirmTitle")}
      closeLabel={tc("close")}
      onClose={close}
      open={open}
      title={
        <Row gap="100">
          <ZibbyOrb size={22} state="speak" />
          {t("confirmTitle")}
        </Row>
      }
      width="md"
    >
      <Stack gap="150">
        <Typography type="text" variant="secondary">
          {t("confirmIntro")}
        </Typography>
        {!anyOn ? (
          <Typography data-testid={AutomatConfirmTestId.NothingOn} tone="warn" type="text">
            {t("confirmNothingOn")}
          </Typography>
        ) : null}
        {exceptions.length > 0 ? (
          <Stack data-testid={AutomatConfirmTestId.Exceptions} gap="50">
            <Typography type="text" variant="secondary">
              {t("confirmExceptions")}
            </Typography>
            {exceptions.map(({ scope, entries }) => (
              <Typography key={scope.node} size="sm" type="text" variant="secondary">
                <b>{scope.label}</b>:{" "}
                {entries.map((e) => `${t(e.key)} → ${t(`mode_${e.lane}`)}`).join(", ")}
              </Typography>
            ))}
          </Stack>
        ) : null}
        <Container padding="150">
          <Stack data-testid={AutomatConfirmTestId.Never} gap="100">
            <Row gap="50">
              <Icon name="lock" size="sm" />
              <Typography type="label">{t("alwaysAsks")}</Typography>
            </Row>
            <NeverList />
          </Stack>
        </Container>
        <Typography type="text" variant="secondary">
          {t("confirmPending", { pending: pendingApprovals })}
        </Typography>
        {showField ? (
          <TextInputField
            autoComplete="off"
            data-testid={AutomatConfirmTestId.Token}
            hint={t("tokenHint")}
            label={t("operatorToken")}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="zby_op_…"
            type="password"
            value={typed}
          />
        ) : (
          <Row data-testid={AutomatConfirmTestId.TokenVerified} gap="100">
            <Icon name="check" size="sm" tone="ok" />
            <Typography type="text">{t("tokenSet")}</Typography>
            <Button intent="ghost" onClick={() => setReplace(true)} size="sm">
              {t("tokenReplace")}
            </Button>
          </Row>
        )}
        {error ? (
          <Typography data-testid={AutomatConfirmTestId.Error} tone="bad" type="text">
            {error === "token" ? t("operatorTokenMissing") : t("failed")}
          </Typography>
        ) : null}
      </Stack>
    </Dialog>
  );
}
