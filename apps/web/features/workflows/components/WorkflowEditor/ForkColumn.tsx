"use client";
import { useRouter } from "next/navigation";
import { Container, Icon, Pressable, Typography } from "@zibby/design-system";
import { useWdT } from "./useWdT";
import type { GraphNode } from "../WorkflowDialog/workflow-graph";
import type { Rect } from "./canvasLayout";
import { phaseName } from "./PhaseCard";

export enum ForkColumnTestId {
  Badge = "fork-badge",
  Branch = "fork-branch",
}

export interface ForkColumnProps {
  node: GraphNode;
  /** The fork column's whole rect and the stacked branch rects (see `placeChain`). */
  column: Rect;
  branches: readonly Rect[];
  /** Child workflow id → display name. */
  workflowNames?: ReadonlyMap<string, string>;
  selected: boolean;
  problem: boolean;
  onSelect: (id: string) => void;
}

/**
 * A `parallel` phase on the canvas: one card per branch (branch id + child workflow name,
 * a click opens that workflow), plus a small badge under the stack that selects the phase
 * for the Inspector. Read-only: branches are edited in the recipe file.
 */
export function ForkColumn({
  node,
  column,
  branches,
  workflowNames,
  selected,
  problem,
  onSelect,
}: ForkColumnProps) {
  const t = useWdT("workflowDetail.canvas");
  const router = useRouter();
  const defs = node.branches ?? [];
  return (
    <>
      {branches.map((rect, i) => {
        const b = defs[i];
        if (!b) return null;
        const name = workflowNames?.get(b.workflow) ?? b.workflow;
        return (
          <Pressable
            aria-label={t("branchAria", { id: b.id, workflow: name })}
            data-nopan=""
            data-testid={`${ForkColumnTestId.Branch}-${node.id}-${b.id}`}
            key={b.id}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/work/workflows/${encodeURIComponent(b.workflow)}`);
            }}
            style={{
              position: "absolute",
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              zIndex: 3,
              textAlign: "left",
              background: "var(--color-surface)",
              border: `1px solid ${problem ? "var(--color-bad)" : selected ? "var(--color-ink)" : "var(--color-border-strong)"}`,
              borderRadius: 12,
              boxShadow: "var(--shadow-card)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <Typography mono truncate size="2xs" type="note" variant="tertiary">
              {b.id}
            </Typography>
            <Typography truncate size="sm" type="note" weight="semibold">
              {`↳ ${name}`}
            </Typography>
          </Pressable>
        );
      })}
      <Pressable
        aria-pressed={selected}
        data-node-id={node.id}
        data-testid={ForkColumnTestId.Badge}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        style={{
          position: "absolute",
          left: column.x,
          top: column.y + column.h + 8,
          width: column.w,
          zIndex: 3,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Container
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 24,
            padding: "0 10px",
            borderRadius: 999,
            background: "var(--color-background)",
            border: `1px solid ${selected ? "var(--color-ink)" : "var(--color-border-strong)"}`,
          }}
        >
          <Icon name="flow" size="xs" tone="dim" />
          <Typography size="2xs" type="note" weight="semibold">
            {`${phaseName(node.id)} · ${t("forkBadge", { n: defs.length })}`}
          </Typography>
        </Container>
      </Pressable>
    </>
  );
}
