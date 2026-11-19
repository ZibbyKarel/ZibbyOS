"use client";

import {
  Container,
  Stack,
  SummaryRow,
  Typography,
  type ZibbyMode,
  ZibbyOrb,
} from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MODE_ORB } from "../modeMeta";
import { ZibbyModeCards } from "./ZibbyModeCards";

export enum ZibbyModePanelTestId {
  Root = "zibby-mode-panel",
  Head = "zibby-mode-panel-head",
  Pending = "zibby-mode-panel-pending",
  Levels = "zibby-mode-panel-levels",
}

export const AUTONOMY_HREF = "/governance/autonomy";
export const APPROVALS_HREF = "/activity/approvals";

export interface ZibbyModePanelProps {
  mode: ZibbyMode;
  onSelect: (mode: ZibbyMode) => void;
  pendingApprovals: number;
  /** Names of the companies/teams that override something; empty = "no exceptions". */
  exceptions: string[];
  /** Called after a link is followed, so the popover/sheet can close. */
  onNavigate: () => void;
  big?: boolean;
}

/** Body of the mode popover (desktop) and bottom sheet (phone): head, radio cards and two links. */
export function ZibbyModePanel({
  mode,
  onSelect,
  pendingApprovals,
  exceptions,
  onNavigate,
  big = false,
}: ZibbyModePanelProps) {
  const t = useTranslations("autopilot");
  const router = useRouter();
  const go = (href: string) => {
    router.push(href as Route);
    onNavigate();
  };
  const state = t(`modeState_${mode}`);
  return (
    <Stack data-testid={ZibbyModePanelTestId.Root} gap="100">
      <Container padding="200">
        <Stack align="center" data-testid={ZibbyModePanelTestId.Head} direction="row" gap="200">
          <span aria-label={t("zibbyIs", { state: state.toLowerCase() })} role="img">
            <ZibbyOrb size={52} state={MODE_ORB[mode]} />
          </span>
          <Stack gap="25">
            <Typography type="label">
              {t(`mode_${mode}`)} · {t("zibbyIs", { state: state.toLowerCase() })}
            </Typography>
            <Typography size="xs" type="note" variant="secondary">
              {t(`modeDesc_${mode}`)}
            </Typography>
          </Stack>
        </Stack>
      </Container>
      <Container padding={["0", "100"]}>
        <ZibbyModeCards big={big} mode={mode} onSelect={onSelect} />
      </Container>
      <Container padding={["0", "100", "100", "100"]}>
        {pendingApprovals > 0 ? (
          <div data-testid={ZibbyModePanelTestId.Pending}>
            <SummaryRow
              icon="bell"
              label={t("pendingLink", { count: pendingApprovals })}
              onClick={() => go(APPROVALS_HREF)}
            />
          </div>
        ) : null}
        <div data-testid={ZibbyModePanelTestId.Levels}>
          <SummaryRow
            icon="shield"
            label={t("levelsLink")}
            onClick={() => go(AUTONOMY_HREF)}
            value={
              exceptions.length > 0
                ? t("exceptionsList", { names: exceptions.join(", ") })
                : t("noExceptions")
            }
          />
        </div>
      </Container>
    </Stack>
  );
}
