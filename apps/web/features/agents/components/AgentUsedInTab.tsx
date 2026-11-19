"use client";

import { useTranslations } from "next-intl";
import { useDetailT } from "../useDetailT";
import Link from "next/link";
import type { Route } from "next";
import { Container, Grid, Icon, Panel, Stack, Tag, Typography } from "@zibby/design-system";
import { AgentDetailScreenTestId as TestId } from "../agentTestIds";
import type { WorkflowUse } from "./agentWorkflows";

/** A mini phase graph: every phase as a chip, the agent's own phases highlighted. */
export function PhaseThumb({ labels, mine }: { labels: string[]; mine: number[] }) {
  return (
    <Stack wrap align="center" direction="row" gap="50" role="list">
      {labels.map((label, i) => (
        <Stack align="center" direction="row" gap="50" key={i} role="listitem">
          {i > 0 && (
            <Typography size="2xs" type="note" variant="tertiary">
              →
            </Typography>
          )}
          <Tag tone={mine.includes(i) ? "accent" : "neutral"}>{label}</Tag>
        </Stack>
      ))}
    </Stack>
  );
}

export interface AgentUsedInTabProps {
  uses: WorkflowUse[];
}

/** "Used in workflows": one card per workflow with the mini phase strip (no per-workflow stats yet). */
export function AgentUsedInTab({ uses }: AgentUsedInTabProps) {
  const t = useTranslations("agents");
  const td = useDetailT();
  if (uses.length === 0)
    return (
      <Typography size="sm" type="note" variant="tertiary">
        {t("notInWorkflow")}
      </Typography>
    );
  return (
    <Stack gap="150">
      <Grid cols={1} gap="150" lg={2}>
        {uses.map(({ workflow, phaseIndexes }) => (
          <Link
            data-testid={TestId.UsedCard}
            href={`/work/workflows/${workflow.id}` as Route}
            key={workflow.id}
          >
            <Panel padding="150">
              <Stack gap="150">
                <Stack align="center" direction="row" gap="100">
                  <Icon name="flow" size="sm" tone="faint" />
                  <Container grow minW0>
                    <Typography truncate size="sm" type="note" weight="bold">
                      {workflow.name ?? workflow.id}
                    </Typography>
                  </Container>
                  <Tag>
                    {td("phaseNumbers", {
                      count: phaseIndexes.length,
                      n: phaseIndexes.map((i) => i + 1).join(", "),
                    })}
                  </Tag>
                </Stack>
                <PhaseThumb
                  labels={workflow.phases.map((p, i) => p.id ?? String(i + 1))}
                  mine={phaseIndexes}
                />
              </Stack>
            </Panel>
          </Link>
        ))}
      </Grid>
      <Typography size="xs" type="note" variant="tertiary">
        {td("matchedById")}
      </Typography>
    </Stack>
  );
}
