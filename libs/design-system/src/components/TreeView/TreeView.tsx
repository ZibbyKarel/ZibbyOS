"use client";

import { type KeyboardEvent, type ReactNode, type Ref, useRef } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum TreeViewTestId {
  Root = "tree-view-root",
  /** Suffixed with the node id, e.g. `tree-view-row-vault:note`. */
  Row = "tree-view-row",
}

export interface TreeNode {
  id: string;
  label: string;
  /** Small marker before the label (a shape, an icon). */
  leading?: ReactNode;
  /** Right-aligned extra (a count, a badge). */
  trailing?: ReactNode;
  /** Emitted as `data-rk` so a detail sheet can anchor next to the row. */
  rowKey?: string;
  /** A branch: clicking toggles it instead of selecting. */
  children?: TreeNode[];
}

export interface TreeViewProps {
  nodes: TreeNode[];
  /** Accessible name of the tree. */
  label: string;
  selectedId?: string | null;
  /** Ids of the expanded branches (controlled). */
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** When given, nodes outside the set are dimmed (a search result view). */
  matchIds?: ReadonlySet<string>;
  ref?: Ref<HTMLDivElement>;
}

/** Indent per depth level, px. */
const INDENT = 13;

/**
 * Selectable, keyboard-navigable tree (ARIA `tree`): Up/Down move between visible rows,
 * Right expands / enters, Left collapses / goes to the parent, Enter or Space activates.
 * Controlled — the parent owns selection and expansion.
 */
export function TreeView({
  nodes,
  label,
  selectedId,
  expandedIds,
  onToggle,
  onSelect,
  matchIds,
  ref,
}: TreeViewProps) {
  const root = useRef<HTMLDivElement>(null);

  const rows = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = rows();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const cur = list[i];
    const expanded = cur?.getAttribute("aria-expanded");
    const focus = (el: HTMLElement | undefined) => {
      if (!el) return;
      e.preventDefault();
      el.focus();
    };
    if (e.key === "ArrowDown") focus(list[i + 1]);
    else if (e.key === "ArrowUp") focus(list[i - 1]);
    else if (e.key === "Home") focus(list[0]);
    else if (e.key === "End") focus(list[list.length - 1]);
    else if (e.key === "ArrowRight" && expanded === "false") {
      e.preventDefault();
      cur?.click();
    } else if (e.key === "ArrowRight" && expanded === "true") focus(list[i + 1]);
    else if (e.key === "ArrowLeft") {
      if (expanded === "true") {
        e.preventDefault();
        cur?.click();
      } else {
        const level = Number(cur?.getAttribute("aria-level"));
        focus(
          [...list.slice(0, i)].reverse().find((r) => Number(r.getAttribute("aria-level")) < level),
        );
      }
    }
  };

  const firstId = nodes[0]?.id;

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const branch = node.children !== undefined;
    const open = branch && expandedIds.has(node.id);
    const selected = node.id === selectedId;
    const dim = matchIds !== undefined && !branch && !matchIds.has(node.id);
    return (
      <div key={node.id} role="none">
        <button
          aria-expanded={branch ? open : undefined}
          aria-level={depth + 1}
          aria-selected={selected}
          className={cn(
            "flex h-[27px] w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-left text-[12.5px]",
            "text-ink-2 hover:bg-hover hover:text-ink",
            selected && "bg-hover font-medium text-ink shadow-[inset_2px_0_0_var(--color-ink)]",
            branch && "font-medium text-ink",
            dim && "opacity-40",
            focusRing,
          )}
          data-rk={node.rowKey}
          data-testid={`${TreeViewTestId.Row}-${node.id}`}
          onClick={() => (branch ? onToggle(node.id) : onSelect(node.id))}
          role="treeitem"
          style={{ paddingLeft: `${4 + depth * INDENT}px` }}
          tabIndex={selected || (!selectedId && node.id === firstId) ? 0 : -1}
          type="button"
        >
          <span
            className={cn(
              "inline-flex w-3 flex-none text-ink-3 transition-transform motion-reduce:transition-none",
              open && "rotate-90",
            )}
          >
            {branch && <Icon name="chevron" size="xs" />}
          </span>
          {node.leading}
          <span className="min-w-0 flex-1 truncate">{node.label}</span>
          {node.trailing}
        </button>
        {open && <div role="group">{node.children?.map((c) => renderNode(c, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div
      aria-label={label}
      data-testid={TreeViewTestId.Root}
      onKeyDown={onKeyDown}
      ref={(el) => {
        root.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      role="tree"
    >
      {nodes.map((n) => renderNode(n, 0))}
    </div>
  );
}
