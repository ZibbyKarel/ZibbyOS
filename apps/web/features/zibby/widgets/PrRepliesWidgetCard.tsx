"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChatWidget } from "@zibby/contracts";
import { Button, Container, Stack, Typography } from "@zibby/design-system";
import { useNow } from "../../../hooks/useNow";
import { prListHref } from "../../inbox/inbox";
import { ReviewThread } from "../../inbox/components/ReviewThread/ReviewThread";
import { useReplyInboxPrThreadMutation } from "../../inbox/mutations";
import { useInboxPrThreadsQuery } from "../../inbox/queries";
import { useProjectsQuery } from "../../projects/queries";
import { ChatWidgetFrame, widgetStatus } from "./ChatWidgetFrame";
import { projectOwnsRepo } from "./PrsWidgetCard";

export enum PrRepliesWidgetCardTestId {
  Root = "pr-replies-widget-card",
  SendAll = "pr-replies-widget-send-all",
  Sent = "pr-replies-widget-sent",
  Resolved = "pr-replies-widget-resolved",
  Missing = "pr-replies-widget-missing",
  Error = "pr-replies-widget-error",
}

export interface PrRepliesWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "pr-replies" }>;
}

interface Draft {
  body: string;
  resolve: boolean;
}

/**
 * `pr-replies` — ZIBBY's proposed replies on a PR's review threads, shown like the PR detail's
 * "Review threads" with the drafts prefilled. Showing the card posts nothing: only the
 * operator's Send / Send all do.
 */
export function PrRepliesWidgetCard({ widget }: PrRepliesWidgetCardProps) {
  const t = useTranslations("zibbyWidgets.prReplies");
  const tThreads = useTranslations("inboxPage.threads");
  const now = useNow(60_000);
  const { data: projects, isPending: projectsPending } = useProjectsQuery();
  const project = (projects ?? []).find((p) => projectOwnsRepo(p, widget.repo));
  const threads = useInboxPrThreadsQuery(project?.id, widget.number);
  const reply = useReplyInboxPrThreadMutation();

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      widget.replies.map((r) => [r.threadId, { body: r.body ?? "", resolve: r.resolve ?? false }]),
    ),
  );
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);

  const byId = new Map((threads.data ?? []).map((th) => [th.id, th]));
  // The card lives on in the transcript: a proposed body already in the thread was sent
  // earlier (before a reload), so it must not be offered again.
  const posted = (id: string) => {
    const body = widget.replies.find((r) => r.threadId === id)?.body?.trim();
    return !!body && !!byId.get(id)?.comments.some((c) => c.body.trim() === body);
  };
  const isSent = (id: string) => sent.has(id) || posted(id);
  const isOpen = (id: string) => {
    const th = byId.get(id);
    return th !== undefined && !th.isResolved && !isSent(id);
  };

  const send = async (threadId: string) => {
    if (!project) return;
    const draft = drafts[threadId] ?? { body: "", resolve: false };
    if (!draft.body.trim() && !draft.resolve) return;
    setFailed((f) => new Set([...f].filter((x) => x !== threadId)));
    try {
      await reply.mutateAsync({
        params: { projectId: project.id, number: widget.number, threadId },
        body: {
          ...(draft.body.trim() ? { body: draft.body } : {}),
          ...(draft.resolve ? { resolve: true } : {}),
        },
      });
      setSent((s) => new Set(s).add(threadId));
    } catch {
      setFailed((f) => new Set(f).add(threadId));
    }
  };

  const sendAll = async () => {
    setSendingAll(true);
    for (const r of widget.replies) if (isOpen(r.threadId)) await send(r.threadId);
    setSendingAll(false);
  };

  const remaining = widget.replies.filter((r) => isOpen(r.threadId)).length;
  const status =
    !projectsPending && !project
      ? "empty"
      : widgetStatus({
          isPending: projectsPending || threads.isPending,
          isError: threads.isError,
          count: widget.replies.length,
        });

  return (
    <ChatWidgetFrame
      count={widget.replies.length}
      emptyText={t("noProject")}
      onRetry={() => void threads.refetch()}
      openHref={prListHref(widget.url)}
      rootTestId={PrRepliesWidgetCardTestId.Root}
      status={status}
      title={widget.title ?? t("title")}
    >
      <Container padding={["100", "150"]}>
        <Stack gap="150">
          {widget.replies.map((r) => {
            const th = byId.get(r.threadId);
            if (!th)
              return (
                <Typography
                  data-testid={PrRepliesWidgetCardTestId.Missing}
                  key={r.threadId}
                  type="bodySm"
                  variant="secondary"
                >
                  {t("missingThread")}
                </Typography>
              );
            const note = isSent(r.threadId)
              ? { id: PrRepliesWidgetCardTestId.Sent, text: t("sent") }
              : th.isResolved
                ? { id: PrRepliesWidgetCardTestId.Resolved, text: t("alreadyResolved") }
                : undefined;
            const draft = drafts[r.threadId] ?? { body: "", resolve: false };
            return (
              <Stack gap="50" key={r.threadId}>
                <ReviewThread
                  now={now}
                  reply={
                    note
                      ? undefined
                      : {
                          ...draft,
                          sending:
                            sendingAll ||
                            (reply.isPending && reply.variables?.params.threadId === r.threadId),
                          onChange: (next) => setDrafts((d) => ({ ...d, [r.threadId]: next })),
                          onSend: () => void send(r.threadId),
                        }
                  }
                  thread={th}
                />
                {note && (
                  <Typography data-testid={note.id} type="bodySm" variant="secondary">
                    {note.text}
                  </Typography>
                )}
                {failed.has(r.threadId) && (
                  <Typography
                    data-testid={PrRepliesWidgetCardTestId.Error}
                    type="bodySm"
                    variant="secondary"
                  >
                    {tThreads("replyError")}
                  </Typography>
                )}
              </Stack>
            );
          })}
          {remaining > 0 && (
            <Stack direction="row" justify="end">
              <Button
                data-testid={PrRepliesWidgetCardTestId.SendAll}
                disabled={sendingAll}
                loading={sendingAll}
                onClick={() => void sendAll()}
                size="sm"
              >
                {t("sendAll")}
              </Button>
            </Stack>
          )}
        </Stack>
      </Container>
    </ChatWidgetFrame>
  );
}
