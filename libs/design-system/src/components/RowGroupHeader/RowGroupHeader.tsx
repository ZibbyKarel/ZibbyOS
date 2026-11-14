import type { Ref } from "react";
import { Icon } from "../Icon/Icon";
import { Progress } from "../Progress/Progress";
import { BoardText } from "../BoardText/BoardText";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum RowGroupHeaderTestId {
  Root = "row-group-header-root",
  Caret = "row-group-header-caret",
  Key = "row-group-header-key",
  Title = "row-group-header-title",
  Count = "row-group-header-count",
}

export interface RowGroupHeaderProps {
  title: string;
  /** Short key (`EPIC-12`, `—`). */
  groupKey: string;
  /** `done/total` text. */
  count: string;
  /** 0–100 for the 2px ink progress bar; omit for a group without progress (the column stays empty). */
  progress?: number;
  closed: boolean;
  onToggle: () => void;
  /** Accessible name of the toggle. */
  label?: string;
  /**
   * `board` (default): caret, key, title, 2px ink bar, count on the board background. `epic`:
   * the redesign's grouped-list header — chevron, mono key (omitted when empty) + title, a 72px
   * 4px bar and the mono fraction, transparent.
   */
  variant?: "board" | "epic";
  ref?: Ref<HTMLButtonElement>;
}

/** A collapsible group header (an epic): caret, key, title, 2px progress, done/total. */
export function RowGroupHeader({
  title,
  groupKey,
  count,
  progress,
  closed,
  onToggle,
  label,
  variant = "board",
  ref,
}: RowGroupHeaderProps) {
  if (variant === "epic") {
    return (
      <button
        aria-expanded={!closed}
        aria-label={label}
        className={cn(
          "box-border grid w-full cursor-pointer grid-cols-[14px_minmax(0,1fr)_72px_auto] items-center gap-[10px] rounded-[8px] bg-transparent px-[10px] pt-[10px] pb-[4px] text-left text-ink hover:bg-ink/[0.035]",
          focusRingInset,
        )}
        data-testid={RowGroupHeaderTestId.Root}
        data-variant="epic"
        onClick={onToggle}
        ref={ref}
        type="button"
      >
        <span
          className={cn(
            "flex text-ink-3 transition-transform duration-150 motion-reduce:transition-none",
            !closed && "rotate-90",
          )}
          data-testid={RowGroupHeaderTestId.Caret}
        >
          <Icon name="chevron" size="xs" />
        </span>
        <span className="flex min-w-0 items-baseline gap-[6px]">
          {groupKey ? (
            <span className="flex flex-none" data-testid={RowGroupHeaderTestId.Key}>
              <BoardText kind="rowId">{groupKey}</BoardText>
            </span>
          ) : null}
          <span
            className="block min-w-0 truncate text-body font-medium"
            data-testid={RowGroupHeaderTestId.Title}
          >
            {title}
          </span>
        </span>
        {progress === undefined ? (
          <span />
        ) : (
          <Progress aria-hidden="true" height="50" tone="ink2" value={Math.max(4, progress)} />
        )}
        <span className="flex" data-testid={RowGroupHeaderTestId.Count}>
          <BoardText kind="rowId">{count}</BoardText>
        </span>
      </button>
    );
  }
  return (
    <button
      aria-expanded={!closed}
      aria-label={label}
      className={cn(
        "box-border grid w-full cursor-pointer grid-cols-[10px_auto_minmax(0,1fr)_56px_auto] items-center gap-[8px] bg-bg px-[var(--bridge-epic-px)] py-[var(--bridge-epic-py)] text-left [border-bottom:var(--bridge-row-border)] hover:bg-panel-2",
        focusRingInset,
      )}
      data-testid={RowGroupHeaderTestId.Root}
      onClick={onToggle}
      ref={ref}
      type="button"
    >
      <span className="text-[10px] text-ink-3" data-testid={RowGroupHeaderTestId.Caret}>
        {closed ? "▸" : "▾"}
      </span>
      <span className="flex" data-testid={RowGroupHeaderTestId.Key}>
        <BoardText kind="meta">{groupKey}</BoardText>
      </span>
      <span className="flex" data-testid={RowGroupHeaderTestId.Title}>
        <BoardText kind="title">{title}</BoardText>
      </span>
      {progress === undefined ? <span /> : <Progress height="25" tone="ink" value={progress} />}
      <span className="flex" data-testid={RowGroupHeaderTestId.Count}>
        <BoardText tabular kind="meta">
          {count}
        </BoardText>
      </span>
    </button>
  );
}
