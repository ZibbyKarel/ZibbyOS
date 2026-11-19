"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  Button,
  Icon,
  SettingsNote,
  SettingsPanel,
  SettingsRow,
  Stack,
  StatusBadge,
  TextLink,
  Typography,
} from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { updateErrorMessage, useEnsureSelfProjectMutation, useSelfStatusQuery } from "../../self";

export enum SelfDevelopmentPanelTestId {
  Root = "self-dev-panel",
  Action = "self-dev-action",
  Error = "self-dev-error",
  /** Polite live region wrapping the inline error. */
  Status = "self-dev-status",
  PrLink = "self-dev-pr",
  /** Shown when the matched self project's path is the running install itself. */
  InstallTreeWarning = "self-dev-install-tree-warning",
}

function projectHref(projectId: string): Route {
  return `/projects/${projectId}` as Route;
}

/**
 * Settings → status: ZIBBY's own repo freshness + open PRs, and the one-click
 * way to register ZIBBY as its own project (self-edit happens in a separate
 * clone and lands as draft PRs; the operator merges). Hidden for a non-git
 * install. Warns when the recognised self project's `path` points at the
 * running install (`projectUsesInstallTree`) — the runbook's Builder ≠ Subject
 * rule wants a separate clone; fixing the path is the operator's call.
 */
export function SelfDevelopmentPanel() {
  const t = useTranslations("settings.selfDev");
  const tp = useTranslations("settings.statusPanels");
  const router = useRouter();
  const { data: status } = useSelfStatusQuery();
  const ensure = useEnsureSelfProjectMutation();
  const [error, setError] = useState<string | null>(null);

  if (!status || status.currentBranch === "") return null;

  const handleAction = () => {
    if (status.projectId) {
      router.push(projectHref(status.projectId));
      return;
    }
    setError(null);
    ensure.mutate(
      { body: {} },
      {
        onSuccess: (response) => {
          if (response.status === 200) router.push(projectHref(response.body.projectId));
        },
        onError: (err) => setError(updateErrorMessage(err) ?? t("failed")),
      },
    );
  };

  return (
    <SettingsPanel
      badge={status.dirty ? <StatusBadge tone="wait">{tp("dirtyBadge")}</StatusBadge> : undefined}
      description={tp("devHint")}
      id="self-dev"
      title={t("title")}
    >
      <div data-testid={SelfDevelopmentPanelTestId.Root}>
        <SettingsRow label={t("branch")}>
          <Stack align="center" direction="row" gap="75">
            <Icon name="branch" size="sm" />
            <Typography mono type="note">
              {status.currentBranch}
            </Typography>
          </Stack>
          <StatusBadge noDot tone="off">
            {t("syncValue", { behind: status.behind, ahead: status.ahead })}
          </StatusBadge>
        </SettingsRow>
        <SettingsRow hint={tp("dirtyHint")} label={t("dirty")}>
          <StatusBadge tone={status.dirty ? "wait" : "ok"}>
            {status.dirty ? t("yes") : t("no")}
          </StatusBadge>
        </SettingsRow>
        <SettingsRow label={t("openPrs")}>
          {status.prs.length === 0 ? (
            <Typography mono size="sm" type="note" variant="tertiary">
              {t("noPrs")}
            </Typography>
          ) : (
            <Stack align="end" gap="50">
              {status.prs.map((pr) => (
                <TextLink
                  data-testid={SelfDevelopmentPanelTestId.PrLink}
                  href={pr.url}
                  key={pr.number}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Typography mono size="sm" type="note" weight="semibold">
                    #{pr.number} {pr.title}
                  </Typography>
                </TextLink>
              ))}
            </Stack>
          )}
        </SettingsRow>
        <SettingsRow hint={t("explain")} label={tp("developAsProject")}>
          <Typography
            aria-live="polite"
            as="span"
            data-testid={SelfDevelopmentPanelTestId.Status}
            role="status"
            size="xs"
            type="note"
          >
            {error && (
              <Typography
                as="span"
                data-testid={SelfDevelopmentPanelTestId.Error}
                size="xs"
                tone="bad"
                type="note"
              >
                {error}
              </Typography>
            )}
          </Typography>
          <Button
            data-testid={SelfDevelopmentPanelTestId.Action}
            intent="secondary"
            loading={ensure.isPending}
            onClick={handleAction}
            size="sm"
          >
            {status.projectId ? t("openProject") : t("ensureProject")}
          </Button>
        </SettingsRow>
        {status.projectUsesInstallTree && (
          <div data-testid={SelfDevelopmentPanelTestId.InstallTreeWarning}>
            <SettingsNote tone="wait">{t("installTreeWarning")}</SettingsNote>
          </div>
        )}
      </div>
    </SettingsPanel>
  );
}
