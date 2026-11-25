"use client";

import { useState } from "react";
import {
  Button,
  EmptyState,
  HeaderIconButton,
  Icon,
  Sheet,
  SheetBanner,
  Stack,
  type SubNavLinkComponent,
  TextLink,
  Typography,
} from "@zibby/design-system";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatWaited } from "../../approvals/approval";
import { useNow } from "../../../hooks/useNow";
import { expiringTokens } from "../../integrations/connectionsModel";
import { accountHref } from "../../integrations/accountHref";
import { useIntegrationsQuery } from "../../integrations";
import { formatWhen } from "../../project-health/formatWhen";
import { apiErrorMessage } from "../../../state/apiErrorMessage";
import { useAnalyzeProjectHealthMutation } from "../../project-health/mutations";
import { useProjectHealthQuery } from "../../project-health/queries";
import { useProjectsQuery } from "../../projects/queries";
import { useMarkNotificationsReadMutation } from "../mutations";
import { useNotificationsQuery } from "../queries";

export enum NotificationBellTestId {
  Trigger = "notification-bell-trigger",
  Item = "notification-bell-item",
  MarkRead = "notification-bell-mark-read",
  MarkAllRead = "notification-bell-mark-all-read",
  HealthItem = "notification-bell-health-item",
  HealthAnalyze = "notification-bell-health-analyze",
  HealthLink = "notification-bell-health-link",
  HealthTaskLink = "notification-bell-health-task-link",
  TokenItem = "notification-bell-token-item",
}

/** The search param that opens the bell's sheet — so any link (e.g. an error Zibby) can open it. */
export const NOTIFICATIONS_PARAM = "notifications";

/**
 * The header bell: unread failed runs, each linking to its run detail with its
 * own "mark read", plus down projects (state, not events: no mark-read, they
 * clear on recovery) with an inline Analyze, plus "mark all read". Reading a failure is what clears a
 * department's (and Zibby's) error state. Integration tokens near (or past) expiry sit on top,
 * cannot be marked read, and link to that integration so the token can be replaced. Rows use the
 * PR sheet's failure banner look (`SheetBanner`).
 */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: items = [] } = useNotificationsQuery();
  const { data: healthStatuses = [] } = useProjectHealthQuery();
  const { data: projects = [] } = useProjectsQuery();
  const analyze = useAnalyzeProjectHealthMutation();
  // Per-row Analyze feedback, keyed by project: the started task or the last failure.
  const [feedback, setFeedback] = useState<Record<string, { taskId?: string; error?: string }>>({});
  const analyzeProject = (projectId: string) => {
    setFeedback((f) => ({ ...f, [projectId]: {} }));
    analyze.mutate(
      { params: { projectId }, body: {} },
      {
        onSuccess: (res) =>
          setFeedback((f) => ({ ...f, [projectId]: { taskId: res.body.taskId } })),
        onError: (error) =>
          setFeedback((f) => ({
            ...f,
            [projectId]: { error: apiErrorMessage(error) ?? t("healthActionFailed") },
          })),
      },
    );
  };
  const downProjects = healthStatuses.filter((s) => s.state === "down");
  const now = useNow(60_000);
  const { data: integrations = [] } = useIntegrationsQuery();
  const tokens = expiringTokens(integrations, now);
  const total = items.length + downProjects.length + tokens.length;
  const markRead = useMarkNotificationsReadMutation();
  const open = searchParams.has(NOTIFICATIONS_PARAM);

  const setOpen = (next: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set(NOTIFICATIONS_PARAM, "open");
    else params.delete(NOTIFICATIONS_PARAM);
    const qs = params.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  return (
    <>
      <HeaderIconButton
        aria-label={t("bellLabel", { count: total })}
        badge={total > 0 ? total : undefined}
        badgeTone="attention"
        data-testid={NotificationBellTestId.Trigger}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" size="md" />
      </HeaderIconButton>
      <Sheet
        footer={
          items.length > 0 && (
            <Button
              block
              data-testid={NotificationBellTestId.MarkAllRead}
              icon="check"
              intent="primary"
              loading={markRead.isPending}
              onClick={() => markRead.mutate({ body: {} })}
            >
              {t("markAllRead")}
            </Button>
          )
        }
        onClose={() => setOpen(false)}
        open={open}
        title={t("title")}
      >
        {total === 0 ? (
          <EmptyState body={t("empty")} title={t("emptyTitle")} />
        ) : (
          <Stack gap="100">
            {tokens.map(({ integration, daysLeft, expired }) => {
              const name = integration.name ?? integration.id;
              return (
                <Link
                  data-testid={NotificationBellTestId.TokenItem}
                  href={accountHref(integration)}
                  key={integration.id}
                >
                  <SheetBanner
                    icon="warn"
                    text={t("tokenAction")}
                    title={
                      expired
                        ? t("tokenExpired", { name })
                        : t("tokenExpiring", { name, days: daysLeft })
                    }
                    tone={expired ? "error" : "blocked"}
                  />
                </Link>
              );
            })}
            {downProjects.map((s) => {
              const name = projects.find((p) => p.id === s.projectId)?.name ?? s.projectId;
              const fb = feedback[s.projectId];
              const taskId = s.analysisTaskId ?? fb?.taskId;
              const rowAnalyzing =
                analyze.isPending && analyze.variables?.params.projectId === s.projectId;
              return (
                <Stack data-testid={NotificationBellTestId.HealthItem} gap="25" key={s.projectId}>
                  <SheetBanner
                    actions={
                      <Button
                        data-testid={NotificationBellTestId.HealthAnalyze}
                        disabled={rowAnalyzing}
                        icon="search"
                        intent="ghost"
                        onClick={() => analyzeProject(s.projectId)}
                        size="sm"
                      >
                        {taskId ? t("healthAnalyzeAgain") : t("healthAnalyze")}
                      </Button>
                    }
                    icon="warn"
                    title={
                      <Link
                        data-testid={NotificationBellTestId.HealthLink}
                        href={`/projects/${s.projectId}` as Route}
                      >
                        {t("healthDown", { name, since: formatWhen(s.sinceAt) })}
                      </Link>
                    }
                    tone="error"
                  />
                  {taskId && (
                    <TextLink
                      data-testid={NotificationBellTestId.HealthTaskLink}
                      href={`/work/tasks/${taskId}` as Route}
                      linkComponent={Link as SubNavLinkComponent}
                    >
                      {t("healthAnalysisStarted")}
                    </TextLink>
                  )}
                  {fb?.error && (
                    <Typography role="alert" size="xs" type="note" variant="secondary">
                      {fb.error}
                    </Typography>
                  )}
                </Stack>
              );
            })}
            {items.map((n) => (
              <Stack data-testid={NotificationBellTestId.Item} gap="0" key={n.runId}>
                <SheetBanner
                  actions={
                    <Button
                      aria-label={t("markRead")}
                      data-testid={NotificationBellTestId.MarkRead}
                      disabled={markRead.isPending}
                      icon="check"
                      intent="ghost"
                      onClick={() => markRead.mutate({ body: { runIds: [n.runId] } })}
                      size="sm"
                    />
                  }
                  icon="warn"
                  text={[n.department, formatWaited(n.failedAt)].filter(Boolean).join(" · ")}
                  title={<Link href={`/activity/runs/${n.runId}` as Route}>{n.title}</Link>}
                  tone="error"
                />
              </Stack>
            ))}
          </Stack>
        )}
      </Sheet>
    </>
  );
}
