"use client";

import { useMemo, useState } from "react";
import { type TreeNode, TreeView, Typography } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import type { MemoryTier } from "@zibby/contracts";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import {
  type BrainGraphData,
  type BrainTreeNode,
  branchIds,
  branchPathTo,
  buildBrainTree,
  treeBranchId,
} from "../brainModel";
import { SourceShape } from "./SourceShape";

export interface BrainTreeProps {
  /** The already filtered graph — the tree always shows the same notes as the canvas. */
  graph: BrainGraphData;
  sourceColor: (sourceId: string) => string;
  sourceName: (sourceId: string) => string;
  selectedId: string | null;
  /** Search hits (non-matching notes fade, every branch opens). null = no search. */
  matchIds: ReadonlySet<string> | null;
  onSelect: (id: string) => void;
}

const ROOT_ID = treeBranchId("index");

/**
 * "Poznámky": the read-only text twin of the graph — Index → Vault (tier → department shelf) and
 * each team KB (folder → note). Selecting a row selects the same note as clicking its node, and a
 * selection made on the canvas expands the tree down to its row.
 */
export function BrainTree({
  graph,
  sourceColor,
  sourceName,
  selectedId,
  matchIds,
  onSelect,
}: BrainTreeProps) {
  const t = useTranslations("knowledge.brain.tree");
  const tm = useTranslations("memory");
  const departments = useDepartmentLookup();
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set([ROOT_ID, treeBranchId("vault")]),
  );

  const tree = useMemo(
    () =>
      buildBrainTree(graph, {
        tier: (tier: MemoryTier) => tm(`tier.${tier}`),
        shelf: (d) => (d ? departments.name(d) : t("shelfGeneral")),
        sourceName,
      }),
    [graph, tm, t, departments, sourceName],
  );

  // A selection made elsewhere (graph, deep link) opens the branches down to it — adjusted during
  // render (not in an effect) so the tree never paints collapsed first.
  const [seen, setSeen] = useState<string | null>(null);
  if (selectedId !== seen) {
    setSeen(selectedId);
    const path = selectedId ? branchPathTo(tree, selectedId) : [];
    if (path.length > 0 && !path.every((id) => open.has(id)))
      setOpen(new Set([...open, ROOT_ID, ...path]));
  }

  const expanded = useMemo(
    () => (matchIds ? new Set([ROOT_ID, ...branchIds(tree)]) : open),
    [matchIds, open, tree],
  );

  const toTree = (n: BrainTreeNode): TreeNode => ({
    id: n.id,
    label: n.label,
    ...(n.children
      ? {
          children: n.children.map(toTree),
          trailing: (
            <Typography mono size="2xs" type="note" variant="tertiary">
              {n.count}
            </Typography>
          ),
          ...(n.id === treeBranchId(n.sourceId)
            ? {
                leading: (
                  <SourceShape
                    color={sourceColor(n.sourceId)}
                    shape={n.sourceId === "vault" ? "vault" : "kb"}
                  />
                ),
              }
            : {}),
        }
      : {}),
  });

  const noteCount = graph.nodes.filter((n) => !n.hub).length;
  const nodes: TreeNode[] = [
    {
      id: ROOT_ID,
      label: t("index"),
      leading: <SourceShape color="var(--color-ink)" shape="hub" />,
      trailing: (
        <Typography mono size="2xs" type="note" variant="tertiary">
          {noteCount}
        </Typography>
      ),
      children: tree.map(toTree),
    },
  ];

  return (
    <TreeView
      expandedIds={expanded}
      label={t("label")}
      matchIds={matchIds ?? undefined}
      nodes={nodes}
      onSelect={onSelect}
      onToggle={(id) =>
        setOpen((prev) => {
          const next = new Set(prev);
          if (!next.delete(id)) next.add(id);
          return next;
        })
      }
      selectedId={selectedId}
    />
  );
}
