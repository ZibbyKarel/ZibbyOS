"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  SettingsNote,
  SettingsPanel,
  SettingsRow,
  StatusBadge,
  TextInputField,
  Typography,
} from "@zibby/design-system";
import { readOperatorToken, writeOperatorToken } from "../../../state/operatorToken";

export enum OperatorTokenSectionTestId {
  Input = "operator-token-input",
  Save = "operator-token-save",
  Status = "operator-token-status",
  Replace = "operator-token-replace",
  Remove = "operator-token-remove",
}

const META_KEY = "zibby.operatorToken.meta";

interface TokenMeta {
  at: string;
  browser: string;
}

/** Client-only metadata about the stored token — written on save, never on mount. */
function readMeta(): TokenMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as TokenMeta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: TokenMeta | null): void {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch {
    /* storage blocked — metadata is cosmetic */
  }
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Electron\//.test(ua)) return "ZibbyOS desktop";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "browser";
}

export interface OperatorTokenSectionProps {
  /** Called after the token is persisted (optional). */
  onSaved?: () => void;
}

/**
 * Access → Operator token. The API's operator token (env `ZIBBY_OPERATOR_TOKEN` or
 * `~/.config/zibby/operator-token`) lives in this browser's localStorage and is sent on
 * approval decisions; without it approve/reject/revise/answer get a 401. Only the last 4
 * characters are ever shown.
 */
export function OperatorTokenSection({ onSaved }: OperatorTokenSectionProps) {
  const t = useTranslations("settings");
  const ta = useTranslations("settings.access");
  const [stored, setStored] = useState(readOperatorToken);
  const [meta, setMeta] = useState(readMeta);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const saved = stored !== "";
  const showInput = !saved || editing;

  const save = () => {
    const next = value.trim();
    writeOperatorToken(next);
    const now = readOperatorToken();
    const nextMeta = now ? { at: new Date().toISOString(), browser: browserName() } : null;
    writeMeta(nextMeta);
    setStored(now);
    setMeta(nextMeta);
    setValue("");
    setEditing(false);
    onSaved?.();
  };
  const remove = () => {
    writeOperatorToken("");
    writeMeta(null);
    setStored("");
    setMeta(null);
    setEditing(false);
  };

  return (
    <SettingsPanel
      badge={
        <StatusBadge data-testid={OperatorTokenSectionTestId.Status} tone={saved ? "ok" : "wait"}>
          {saved ? t("operatorTokenSaved") : t("operatorTokenMissing")}
        </StatusBadge>
      }
      description={t("operatorTokenHint")}
      id="operator-token"
      title={t("operatorToken")}
      tone={saved ? "default" : "attention"}
    >
      {saved && (
        <SettingsRow
          hint={
            meta ? ta("tokenMeta", { at: meta.at.slice(0, 10), browser: meta.browser }) : undefined
          }
          label={ta("tokenStored")}
        >
          <Typography mono type="note">
            {`•••• ${stored.slice(-4)}`}
          </Typography>
          {!editing && (
            <>
              <Button
                data-testid={OperatorTokenSectionTestId.Replace}
                intent="ghost"
                onClick={() => setEditing(true)}
                size="sm"
              >
                {ta("replace")}
              </Button>
              <Button
                data-testid={OperatorTokenSectionTestId.Remove}
                intent="ghost"
                onClick={remove}
                size="sm"
              >
                {ta("remove")}
              </Button>
            </>
          )}
        </SettingsRow>
      )}
      {showInput && (
        <SettingsRow stack label={ta("tokenPaste")}>
          <TextInputField
            hideLabel
            autoComplete="off"
            data-testid={OperatorTokenSectionTestId.Input}
            label={t("operatorToken")}
            onChange={(e) => setValue(e.target.value)}
            type="password"
            value={value}
          />
          <Button
            data-testid={OperatorTokenSectionTestId.Save}
            intent="primary"
            onClick={save}
            size="sm"
          >
            {t("operatorTokenSave")}
          </Button>
        </SettingsRow>
      )}
      <SettingsNote>{ta("tokenNote")}</SettingsNote>
    </SettingsPanel>
  );
}
