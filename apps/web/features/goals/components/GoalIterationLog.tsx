"use client";

import { useTranslations } from "next-intl";
import { CodeBlock, Stack, Typography } from "@zibby/design-system";
import type { GoalIteration } from "@zibby/contracts";
import { RunLogStream } from "../../runs/components/RunLogStream";
import { WorkflowStageTimeline } from "../../runs/components/WorkflowStageTimeline";
import { useWorkflowRunQuery } from "../../workflows";

export interface GoalIterationLogProps {
  iteration: GoalIteration;
}

/**
 * The expanded body of one iteration: the maker's log (agent) or stage timeline (workflow),
 * the verifier's log and its verdict. Mounted only while the row is open, so at most one
 * log poller runs at a time.
 */
export function GoalIterationLog({ iteration: it }: GoalIterationLogProps) {
  const t = useTranslations("runs");
  const makerWorkflowId = it.makerKind === "workflow" ? (it.makerRunRef ?? null) : null;
  const { data: makerWorkflow } = useWorkflowRunQuery(makerWorkflowId);
  const live = it.status === "running";
  const log = (runId: string) => (
    <RunLogStream
      key={runId}
      linesLabel={(n) => t("lines", { n })}
      live={live}
      liveLabel={t("liveLog")}
      logLabel={t("log")}
      runId={runId}
    />
  );

  return (
    <Stack gap="100">
      {it.makerKind === "agent" && it.makerRunRef ? (
        <Stack gap="50">
          <Typography uppercase size="2xs" type="note" variant="tertiary">
            {t("goalMakerLog")}
          </Typography>
          {log(it.makerRunRef)}
        </Stack>
      ) : makerWorkflowId ? (
        makerWorkflow ? (
          <WorkflowStageTimeline
            currentStage={makerWorkflow.currentStage}
            live={makerWorkflow.status === "running"}
            owner={makerWorkflow.owner}
            parked={makerWorkflow.parked}
            stageRuns={makerWorkflow.stageRuns}
            workflowRunId={makerWorkflowId}
          />
        ) : (
          <Typography mono size="2xs" type="note" variant="tertiary">
            {t("stageLoading")}
          </Typography>
        )
      ) : null}
      {it.verifier.runRef ? (
        <Stack gap="50">
          <Typography uppercase size="2xs" type="note" variant="tertiary">
            {t("goalVerifierLog")}
          </Typography>
          {log(it.verifier.runRef)}
        </Stack>
      ) : null}
      {it.verifier.output ? (
        <Stack gap="50">
          <Typography uppercase size="2xs" type="note" variant="tertiary">
            {t("goalVerifierVerdict")}
          </Typography>
          <CodeBlock maxHeight="md" text={it.verifier.output} />
        </Stack>
      ) : null}
    </Stack>
  );
}
