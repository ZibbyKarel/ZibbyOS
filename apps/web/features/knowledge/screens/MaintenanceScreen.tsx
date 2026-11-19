"use client";

import { useMemo, useState } from "react";
import type { Automation } from "@zibby/contracts";
import {
  Button,
  Container,
  Grid,
  List,
  ListItem,
  ListItemText,
  Panel,
  Stack,
  Typography,
} from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useAutomationsQuery } from "../../automations/queries";
import { useTriggerAutomationMutation } from "../../automations/mutations";
import { relativeLabel } from "../../automations/schedule";
import { useCronLabel } from "../../automations/useCronLabel";
import { QueryError } from "../../../components/LoadError/QueryError";
import { QueryLoading } from "../../../components/LoadingState/QueryLoading";
import { PageContainer } from "../../../components/PageContainer/PageContainer";
import { TeamKbIngest } from "../components/TeamKbIngest";
import { useBrainData } from "../hooks/useBrainData";
import { SourceShape } from "../components/SourceShape";
import { brainId } from "../brainModel";
import { SelfKnowledgeSection } from "../components/SelfKnowledgeSection";

/** The two department-owned (KNW) distillation automation targets this screen covers. */
const DISTILL_TARGET_TYPES = ["memory-distill", "gap-detect"] as const;
type DistillTargetType = (typeof DISTILL_TARGET_TYPES)[number];
function isDistillTarget(type: string): type is DistillTargetType {
  return (DISTILL_TARGET_TYPES as readonly string[]).includes(type);
}

/**
 * One triggered run's outcome, kept in local screen state only — recon (ZB-09)
 * found no persisted run history for an automation beyond `lastFiredAt`: the
 * trigger endpoint returns a `runRef` synchronously and nothing else is stored.
 * Showing more than that would invent fields the backend doesn't have.
 */
interface RunLogLine {
  automationId: string;
  at: string;
  ref: string;
}

/** The ZibbyOS vault's distillation automations (memory-distill, gap-detect). */
export enum MaintenanceScreenTestId {
  Pending = "maintenance-pending",
  Question = "maintenance-question",
  Ingest = "maintenance-ingest",
}

/** Údržba: distillation of the vault, the self-model, team KB ingest and the questions waiting for the operator. */
export function MaintenanceScreen() {
  const t = useTranslations("knowledge");
  const tm = useTranslations("knowledge.maintenance");
  const router = useRouter();
  const brain = useBrainData();
  const kbs = brain.sources.filter((s) => s.kind === "kb");
  const ta = useTranslations("settings");
  const locale = useLocale();
  const cronLabel = useCronLabel();
  const automationsQuery = useAutomationsQuery();
  const trigger = useTriggerAutomationMutation();
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<RunLogLine[]>([]);
  // Captured once at mount — coarse (minute/hour) relative labels on a
  // short-lived screen, same posture as `SystemAutomationRow`'s own `now`.
  const [now] = useState(() => Date.now());

  const automations = useMemo(
    () => (automationsQuery.data ?? []).filter((a) => isDistillTarget(a.target.type)),
    [automationsQuery.data],
  );
  const current = automations.find((a) => a.id === selected) ?? automations[0];

  const runNow = (automation: Automation) => {
    trigger.mutate(
      { params: { id: automation.id }, body: {} },
      {
        onSuccess: ({ body }) => {
          setLog((prev) => [
            { automationId: automation.id, at: new Date().toISOString(), ref: body.runRef },
            ...prev,
          ]);
        },
      },
    );
  };

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <Stack wrap align="end" direction="row" gap="150" justify="between">
            <Stack gap="25">
              <Typography type="title">{tm("title")}</Typography>
              <Typography
                data-testid={MaintenanceScreenTestId.Pending}
                size="sm"
                type="note"
                variant="tertiary"
              >
                {tm("pending", { count: brain.openQuestions.length })}
              </Typography>
            </Stack>
          </Stack>

          {automationsQuery.isPending ? (
            <QueryLoading />
          ) : automationsQuery.isError ? (
            <QueryError onRetry={() => void automationsQuery.refetch()} />
          ) : automations.length === 0 ? (
            <Panel header={t("distill.log")} padding="300">
              <Typography size="sm" type="note" variant="tertiary">
                {t("distill.noAutomations")}
              </Typography>
            </Panel>
          ) : (
            <Grid align="start" gap="200" sidebar="left">
              <List>
                {automations.map((a) => {
                  const runs = log.filter((l) => l.automationId === a.id);
                  return (
                    <ListItem
                      active={a.id === current?.id}
                      id={a.id}
                      key={a.id}
                      onSelect={() => setSelected(a.id)}
                    >
                      <ListItemText>
                        <Stack gap="25">
                          <Typography size="sm" type="note" weight="semibold">
                            {a.name ?? a.id}
                          </Typography>
                          <Typography mono size="2xs" type="note" variant="tertiary">
                            {a.trigger.type === "cron" ? cronLabel(a.trigger.expr) : a.trigger.type}
                            {" · "}
                            {runs.length}
                          </Typography>
                        </Stack>
                      </ListItemText>
                    </ListItem>
                  );
                })}
              </List>

              {current && (
                <Panel
                  header={current.name ?? current.id}
                  headerEnd={
                    <Button
                      data-testid="distill-run-now"
                      icon="play"
                      intent="primary"
                      loading={trigger.isPending}
                      onClick={() => runNow(current)}
                      size="sm"
                    >
                      {trigger.isPending ? t("distill.running") : t("distill.runNow")}
                    </Button>
                  }
                  padding="250"
                >
                  <Stack gap="200">
                    <Typography size="sm" type="note" variant="secondary">
                      {isDistillTarget(current.target.type)
                        ? ta(`automations.desc.${current.target.type}`)
                        : ""}
                    </Typography>
                    <Typography mono size="2xs" type="note" variant="tertiary">
                      {current.lastFiredAt
                        ? t("distill.lastRun", {
                            ago: relativeLabel(Date.parse(current.lastFiredAt), now, locale),
                          })
                        : t("distill.neverRun")}
                    </Typography>

                    <Typography mono size="2xs" type="note" variant="tertiary">
                      {t("distill.metricsUnavailable")}
                    </Typography>

                    <Typography uppercase size="2xs" type="note" variant="tertiary">
                      {t("distill.log")}
                    </Typography>
                    <Stack gap="75">
                      {log
                        .filter((l) => l.automationId === current.id)
                        .map((l) => (
                          <Typography mono key={l.at} size="xs" type="note" variant="secondary">
                            {new Date(l.at).toLocaleTimeString()} —{" "}
                            {t("distill.outcome", { ref: l.ref })}
                          </Typography>
                        ))}
                    </Stack>
                  </Stack>
                </Panel>
              )}
            </Grid>
          )}

          <Stack gap="150">
            <Typography uppercase size="2xs" type="note" variant="tertiary">
              {t("distill.selfModel.title")}
            </Typography>
            <SelfKnowledgeSection />
          </Stack>

          {brain.openQuestions.length > 0 && (
            <Stack gap="100">
              <Typography uppercase size="2xs" type="note" variant="tertiary">
                {tm("questions")}
              </Typography>
              <Panel padding="150">
                <Stack gap="100">
                  {brain.openQuestions.map((q) => (
                    <Stack
                      align="center"
                      data-testid={MaintenanceScreenTestId.Question}
                      direction="row"
                      gap="100"
                      key={`${q.teamId}:${q.noteId}:${q.text}`}
                    >
                      <SourceShape color="var(--color-warn)" shape="ring" />
                      <Typography size="sm" type="note">
                        {q.text}
                      </Typography>
                      <Button
                        intent="ghost"
                        onClick={() =>
                          router.push(
                            `/knowledge/brain?note=${encodeURIComponent(brainId(q.teamId, q.noteId))}` as Route,
                          )
                        }
                        size="sm"
                      >
                        {q.noteTitle}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Panel>
            </Stack>
          )}

          {kbs.map((kb) => (
            <Stack data-testid={MaintenanceScreenTestId.Ingest} gap="100" key={kb.id}>
              <Typography uppercase size="2xs" type="note" variant="tertiary">
                {tm("ingest", { name: kb.name })}
              </Typography>
              <TeamKbIngest teamId={kb.id} />
            </Stack>
          ))}
        </Stack>
      </PageContainer>
    </Container>
  );
}
