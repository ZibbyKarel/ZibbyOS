"use client";
import type { KeyboardEvent, PointerEvent } from "react";
import { useWdT } from "./useWdT";
import type { Agent, Department } from "@zibby/contracts";
import { Container, Icon, Stack, Tag, Typography } from "@zibby/design-system";
import { useTierLabel } from "../../../ai-providers";
import { stepEngineChoice } from "../../../../utils/engine";
import { PhaseAvatar } from "./PhaseAvatar";
import { BAD, SURFACE, mix } from "../WorkflowDialog/canvas-tokens";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";
import { type Lod, type Rect } from "./canvasLayout";

export enum PhaseCardTestId {
  Root = "phase-card",
  Handle = "phase-card-loop-handle",
  Problem = "phase-card-problem",
  When = "phase-card-when",
}

/** "code-reviewer" → "Code reviewer": a phase's display name is its (humanised) id. */
export const phaseName = (id: string): string => {
  const words = id.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export interface PhaseCardProps {
  node: GraphNode;
  rect: Rect;
  agent?: Agent;
  departments?: readonly Department[];
  /** `workflow` step: the child workflow's display name. */
  workflowName?: string;
  /** `workflow` step: how many phases the child workflow has. */
  workflowSize?: number;
  selected: boolean;
  /** The phase has a validation problem (red mark). */
  problem: boolean;
  lod: Lod;
  /** Edit mode shows the loop handle on hover/selection. */
  editing: boolean;
  onSelect: (id: string) => void;
  onLoopHandleDown: (id: string, e: PointerEvent) => void;
}

const FILL = "var(--color-surface)";

export function PhaseCard({
  node,
  rect,
  agent,
  departments = [],
  workflowName,
  workflowSize,
  selected,
  problem,
  lod,
  editing,
  onSelect,
  onLoopHandleDown,
}: PhaseCardProps) {
  const t = useWdT("workflowDetail.card");
  const tierLabel = useTierLabel();
  const tp = useWdT("workflowDetail.parity");
  const isAgent = node.type === "agent";
  const choice = stepEngineChoice(node, agent);

  const agentName = agent?.name ?? node.agent;
  // Machine-ish ids ("n9", "p2", "step-3") are no name: fall back to the agent.
  const title =
    /^[a-z]{0,4}[-_]?\d+$/i.test(node.id) && isAgent
      ? phaseName(agent?.displayName ?? agentName)
      : phaseName(node.id);
  const subtitle = isAgent
    ? agentName
    : node.type === "tool"
      ? t("commands", { n: node.commands.split("\n").filter((c) => c.trim()).length })
      : node.type === "workflow"
        ? `↳ ${workflowName || node.workflow || t("noWorkflow")}`
        : node.action || node.id;
  const modelLine = isAgent
    ? `${
        node.openaiModel ??
        choice.engineModel?.split("/").pop() ??
        tierLabel(node.model, choice.engine, true)
      } · ${node.thinking}`
    : node.type === "tool"
      ? `$ ${node.commands.split("\n").find((c) => c.trim()) ?? ""}`
      : node.type === "workflow"
        ? workflowSize === undefined
          ? ""
          : tp("phasesCount", { n: workflowSize })
        : node.produces;

  const when = node.extra?.when;
  const hasAdvisor = isAgent && node.extra?.advisor !== undefined && node.extra.advisor !== false;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onSelect(node.id);
  };

  const isTool = node.type === "tool";
  const isSub = node.type === "workflow";
  const isSystem = node.type === "system";
  const border = problem
    ? mix(BAD, 60)
    : selected
      ? "var(--color-ink)"
      : "var(--color-border-strong)";

  return (
    <Container
      aria-label={t("aria", { title, subtitle })}
      aria-pressed={selected}
      data-node-id={node.id}
      data-testid={PhaseCardTestId.Root}
      height={`${rect.h}px`}
      left={`${rect.x}px`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={onKeyDown}
      position="absolute"
      role="button"
      style={{
        background: isTool ? `color-mix(in srgb, var(--color-ink) 4%, ${FILL})` : FILL,
        border: `1px ${isSystem ? "dashed" : "solid"} ${border}`,
        borderRadius: isTool ? 6 : 12,
        boxShadow: selected
          ? `0 0 0 3px ${mix("var(--color-ink)", 16)}, var(--shadow-card)`
          : isSub
            ? `4px 4px 0 -1px ${SURFACE}, 4px 4px 0 0 var(--color-border-strong), 8px 8px 0 -1px ${SURFACE}, 8px 8px 0 0 var(--color-border-strong)`
            : "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: lod === "full" ? (isTool ? "22px 12px 10px" : "10px 12px") : "0 10px",
        zIndex: 3,
        cursor: "pointer",
      }}
      tabIndex={0}
      top={`${rect.y}px`}
      userSelect="none"
      width={`${rect.w}px`}
    >
      {isTool && lod === "full" && (
        <Container
          aria-hidden="true"
          left="0"
          position="absolute"
          right="0"
          style={{
            top: 0,
            height: 16,
            borderBottom: "1px solid var(--color-border)",
            background: mix("var(--color-ink)", 5),
            borderRadius: "6px 6px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 3,
            paddingLeft: 8,
          }}
        >
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              // eslint-disable-next-line react/forbid-dom-props
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "var(--color-ink-3)",
              }}
            />
          ))}
        </Container>
      )}

      <Stack align="center" direction="row" gap="100">
        <PhaseAvatar agent={agent} departments={departments} node={node} />
        <Container grow minW0>
          <Typography truncate size={lod === "far" ? "xs" : "sm"} type="note" weight="semibold">
            {title}
          </Typography>
          {lod === "full" && (
            <Typography truncate size="xs" type="note" variant="secondary">
              {subtitle}
            </Typography>
          )}
        </Container>
      </Stack>

      {lod === "full" && (
        <Stack
          align="center"
          direction="row"
          gap="75"
          style={{
            margin: "6px -12px 0",
            padding: "6px 12px 0",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Container grow minW0>
            <Typography mono truncate size="2xs" type="note" variant="tertiary">
              {modelLine}
            </Typography>
          </Container>
          {isAgent && node.prompt && (
            <span title={t("hasPrompt")}>
              <Tag>
                <Typography mono as="span" size="2xs" type="note" variant="secondary">
                  ¶
                </Typography>
              </Tag>
            </span>
          )}
          {isAgent && node.skill && (
            <span title={t("hasSkill")}>
              <Tag tone="working">
                <Typography mono as="span" size="2xs" type="note" weight="bold">
                  /
                </Typography>
              </Tag>
            </span>
          )}
          {hasAdvisor && (
            <span title={t("hasAdvisor")}>
              <Typography mono size="2xs" type="note" variant="secondary">
                A
              </Typography>
            </span>
          )}
        </Stack>
      )}

      {when && (
        <Container left="10px" position="absolute" style={{ top: -10 }}>
          <span data-testid={PhaseCardTestId.When} title={t("whenTitle", { phase: when.phase })}>
            <Tag icon="branch" tone="warn">
              {t("when")}
            </Tag>
          </span>
        </Container>
      )}

      <Container
        position="absolute"
        style={{ top: -8, right: -8, display: "flex", gap: 3, alignItems: "center" }}
      >
        {problem && (
          <Container
            aria-label={t("problem")}
            data-testid={PhaseCardTestId.Problem}
            role="img"
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: BAD,
              color: "var(--color-on-status)",
              boxShadow: "0 0 0 3px var(--color-background)",
            }}
          >
            <Icon name="warn" size="xs" />
          </Container>
        )}
      </Container>

      {editing && node.type !== "system" && (
        <Container
          aria-label={t("loopHandle")}
          data-testid={PhaseCardTestId.Handle}
          left="50%"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onLoopHandleDown(node.id, e);
          }}
          position="absolute"
          role="button"
          style={{
            top: -7,
            marginLeft: -6,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--color-background)",
            border: "1.5px dashed var(--color-ink)",
            cursor: "crosshair",
            opacity: selected ? 1 : 0.55,
          }}
          title={t("loopHandleHint")}
        />
      )}
    </Container>
  );
}
