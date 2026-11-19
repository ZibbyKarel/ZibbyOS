"use client";

import { Button, Chip, Progress, Sheet, Stack, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { BrainSourceInfo } from "../hooks/useBrainData";
import type { SourceSync } from "../hooks/useSyncAllSources";
import { SourceShape } from "./SourceShape";

export enum SourceDrawerTestId {
  UpdateAll = "source-drawer-update-all",
  /** Suffixed with the source id. */
  Row = "source-drawer-row",
  Pending = "source-drawer-pending",
  State = "source-drawer-state",
  Retry = "source-drawer-retry",
}

export interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  sources: readonly BrainSourceInfo[];
  sourceColor: (sourceId: string) => string;
  /** Per-source "update all" progress; a source without an entry has not been synced this session. */
  sync: Readonly<Record<string, SourceSync>>;
  running: boolean;
  onUpdateAll: () => void;
  /** Re-run the sync of one source. */
  onRetrySync: (id: string) => void;
  /** Open questions waiting for the operator; 0 hides the link to Údržba. */
  pending?: number;
  onOpenMaintenance?: () => void;
}

/**
 * "Zdroje mozku": one row per source (the vault and every team KB) with its note count, load
 * state, and the live state of the current "Aktualizovat vše" run — queued, pulling, done or
 * failed (with the pull's own message), each failed one retryable on its own.
 */
export function SourceDrawer({
  open,
  onClose,
  sources,
  sourceColor,
  sync,
  running,
  onUpdateAll,
  onRetrySync,
  pending = 0,
  onOpenMaintenance,
}: SourceDrawerProps) {
  const t = useTranslations("knowledge.brain.sources");
  const tk = useTranslations();

  return (
    <Sheet
      ariaLabel={t("title")}
      closeLabel={tk("common.close")}
      footer={
        <Button
          data-testid={SourceDrawerTestId.UpdateAll}
          icon="retry"
          intent="primary"
          loading={running}
          onClick={onUpdateAll}
        >
          {running ? t("updating") : t("updateAll")}
        </Button>
      }
      onClose={onClose}
      open={open}
      title={t("title")}
    >
      <Stack gap="200">
        {pending > 0 && onOpenMaintenance && (
          <Button
            data-testid={SourceDrawerTestId.Pending}
            intent="secondary"
            onClick={onOpenMaintenance}
            size="sm"
          >
            {t("pending", { count: pending })}
          </Button>
        )}
        {sources.map((s) => {
          const run = sync[s.id];
          const phase = run?.phase;
          return (
            <Stack data-testid={`${SourceDrawerTestId.Row}-${s.id}`} gap="75" key={s.id}>
              <Stack align="center" direction="row" gap="100" justify="between">
                <Stack align="center" direction="row" gap="100">
                  <SourceShape
                    color={sourceColor(s.id)}
                    shape={s.kind === "vault" ? "vault" : "kb"}
                  />
                  <Typography type="label" weight="semibold">
                    {s.name}
                  </Typography>
                  <Typography mono size="2xs" type="note" variant="tertiary">
                    {t("notes", { count: s.notes })}
                  </Typography>
                </Stack>
                <Chip
                  dot
                  data-testid={`${SourceDrawerTestId.State}-${s.id}`}
                  pulse={phase === "pulling"}
                  tone={
                    phase === "failed" || (!phase && s.state === "failed")
                      ? "bad"
                      : phase === "pulling"
                        ? "run"
                        : phase === "queued" || (!phase && s.state === "loading")
                          ? "idle"
                          : "ok"
                  }
                >
                  {phase ? t(`phase.${phase}`) : t(`load.${s.state}`)}
                </Chip>
              </Stack>
              <Typography mono size="2xs" type="note" variant="tertiary">
                {s.kind === "vault" ? t("kindVault") : t("kindKb")}
                {phase === "done" &&
                  s.kind === "kb" &&
                  ` · ${run?.updated ? t("pulled") : t("current")}`}
              </Typography>
              {phase === "pulling" && <Progress indeterminate label={t("pulling")} />}
              {phase === "failed" && (
                <Typography size="sm" tone="bad" type="note">
                  {run?.message ?? t("failedGeneric")}
                </Typography>
              )}
              {(phase === "failed" || (!phase && s.state === "failed")) && (
                <Stack align="center" direction="row" gap="100">
                  <Button
                    data-testid={`${SourceDrawerTestId.Retry}-${s.id}`}
                    disabled={running}
                    icon="retry"
                    intent="secondary"
                    onClick={() => (phase === "failed" ? onRetrySync(s.id) : s.retry())}
                    size="sm"
                  >
                    {t("retry")}
                  </Button>
                </Stack>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Sheet>
  );
}
