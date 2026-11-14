"use client";

import { FileDiffView } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";
import { useIsPhone } from "../../../../hooks/useIsPhone";
import { useReplyInboxPrThreadMutation } from "../../mutations";
import { useInboxPrThreadsQuery } from "../../queries";
import { ReviewThread } from "../ReviewThread/ReviewThread";

/** The PR the diff belongs to — enables inline review threads and the "Viewed" marks. */
export interface PrDiffPr {
  projectId: string;
  number: number;
  /** Viewed marks are keyed by it, so a new push resets them. */
  headSha?: string;
}

export interface PrDiffProps {
  /** Unified diff text (as returned by the PR diff endpoint). */
  diff: string;
  /** The diff endpoint cut the diff short — shows the notice above the files. */
  truncated?: boolean;
  pr?: PrDiffPr;
  /** Epoch ms used for the relative comment ages of inline threads. */
  now?: number;
}

interface Draft {
  body: string;
  resolve: boolean;
}
const EMPTY: Draft = { body: "", resolve: false };

const viewedKey = (pr: PrDiffPr) =>
  `zibby.prDiff.viewed:${pr.projectId}#${pr.number}@${pr.headSha ?? ""}`;

function readViewed(key: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Per-PR "Viewed" file marks, client-side only (D12: no backend field). */
function useViewed(pr: PrDiffPr | undefined) {
  const key = pr ? viewedKey(pr) : null;
  const [state, setState] = useState<{ key: string | null; viewed: Record<string, boolean> }>(
    () => ({ key, viewed: key ? readViewed(key) : {} }),
  );
  // A different PR / head sha → re-read during render (no effect round-trip).
  const current = state.key === key ? state : { key, viewed: key ? readViewed(key) : {} };
  if (current !== state) setState(current);
  const set = (path: string, on: boolean) => {
    if (!key) return;
    const viewed = { ...current.viewed, [path]: on };
    if (!on) delete viewed[path];
    setState({ key, viewed });
    try {
      window.localStorage.setItem(key, JSON.stringify(viewed));
    } catch {
      // Storage blocked (private mode) — the marks just don't survive a reload.
    }
  };
  return { viewed: current.viewed, set: key ? set : undefined };
}

/** The PR "Changes" view: cs/en labels, inline review threads and viewed marks over the DS FileDiffView. */
export function PrDiff({ diff, truncated = false, pr, now }: PrDiffProps) {
  const t = useTranslations("inboxPage.prs");
  const isPhone = useIsPhone();
  const { data: threads } = useInboxPrThreadsQuery(pr?.projectId, pr?.number);
  const reply = useReplyInboxPrThreadMutation();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [mountedAt] = useState(() => Date.now());
  const { viewed, set } = useViewed(pr);

  const open = useMemo(
    () => (threads ?? []).filter((th) => !th.isResolved && !th.isOutdated),
    [threads],
  );
  const threadCounts: Record<string, number> = {};
  for (const th of open) threadCounts[th.path] = (threadCounts[th.path] ?? 0) + 1;

  // ponytail: reply wiring mirrors PrThreads (one draft per thread); extract a shared hook if a third caller appears.
  const lineWidgets: Record<string, Record<number, ReactNode>> = {};
  if (pr)
    for (const th of open) {
      if (th.line === null) continue;
      const draft = drafts[th.id] ?? EMPTY;
      (lineWidgets[th.path] ??= {})[th.line] = (
        <ReviewThread
          key={th.id}
          now={now ?? mountedAt}
          reply={{
            ...draft,
            sending: reply.isPending && reply.variables?.params.threadId === th.id,
            onChange: (next) => setDrafts((d) => ({ ...d, [th.id]: next })),
            onSend: () =>
              reply.mutate(
                {
                  params: { projectId: pr.projectId, number: pr.number, threadId: th.id },
                  body: {
                    ...(draft.body.trim() ? { body: draft.body } : {}),
                    ...(draft.resolve ? { resolve: true } : {}),
                  },
                },
                { onSuccess: () => setDrafts((d) => ({ ...d, [th.id]: EMPTY })) },
              ),
          }}
          thread={th}
        />
      );
    }

  return (
    <FileDiffView
      backLabel={t("diff.files")}
      collapseFileLabel={t("diff.collapseFile")}
      collapseLabel={t("diff.collapseFiles")}
      diff={diff}
      emptyLabel={t("diff.empty")}
      expandFileLabel={t("diff.expandFile")}
      expandLabel={t("diff.expandFiles")}
      fileList={!isPhone}
      filesLabel={t("diff.files")}
      filterLabel={t("diff.filter")}
      generatedLabel={t("diff.generated")}
      lineWidgets={lineWidgets}
      noHunksLabel={t("diff.noHunks")}
      notice={truncated ? t("diff.truncated") : undefined}
      onViewedChange={set}
      oneAtATime={isPhone}
      resizeLabel={t("diff.resizeFiles")}
      showGeneratedLabel={t("diff.showGenerated")}
      splitLabel={t("diff.split")}
      splitToggle={!isPhone}
      threadCounts={threadCounts}
      threadsLabel={(count) => t("diff.threads", { count })}
      unifiedLabel={t("diff.unified")}
      viewLabel={t("diff.view")}
      viewed={viewed}
      viewedCountLabel={(n, total) => t("diff.viewedCount", { viewed: n, total })}
      viewedLabel={t("diff.viewed")}
    />
  );
}
