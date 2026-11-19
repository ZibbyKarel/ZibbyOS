import type { ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../Icon/Icon";

export enum MiniTreeTestId {
  Root = "mini-tree-root",
  RootLabel = "mini-tree-root-label",
  Row = "mini-tree-row",
}

export interface MiniTreeRow {
  id: string;
  label: string;
  icon?: IconName;
  /** Right of the label (free-form). */
  trailing?: ReactNode;
  /** Outlined squares drawn before `caption` (design `.co-pj`), capped at 5. */
  squares?: number;
  /** Mono text after the squares ("3 projekty"). */
  caption?: string;
}

export interface MiniTreeProps {
  root: { label: string; icon?: IconName };
  rows: readonly MiniTreeRow[];
  ref?: Ref<HTMLDivElement>;
}

/** Two-level tree with a hairline stem and elbow connectors (design `.co-tree`). */
export function MiniTree({ root, rows, ref }: MiniTreeProps) {
  return (
    <div data-testid={MiniTreeTestId.Root} ref={ref}>
      <span
        className="inline-flex items-center gap-[6px] text-[12px] font-medium text-ink-3"
        data-testid={MiniTreeTestId.RootLabel}
      >
        {root.icon && <Icon name={root.icon} size="sm" />}
        {root.label}
      </span>
      <ul className="m-0 mt-[6px] ml-[6px] list-none border-l border-line-2 p-0 pl-[16px]">
        {rows.map((r) => (
          <li
            className="relative flex items-center gap-[12px] py-[5px] before:absolute before:top-1/2 before:-left-[16px] before:h-px before:w-[11px] before:bg-line-2"
            data-testid={MiniTreeTestId.Row}
            key={r.id}
          >
            <span className="inline-flex min-w-[130px] items-center gap-[6px] text-[13px] font-medium text-ink">
              {r.icon && <Icon name={r.icon} size="sm" />}
              {r.label}
            </span>
            {(r.squares !== undefined || r.caption) && (
              <span className="inline-flex items-center gap-[4px] text-[11.5px] text-ink-3">
                {Array.from({ length: Math.min(r.squares ?? 0, 5) }, (_, i) => (
                  <i className="size-[10px] rounded-[3px] border-[1.5px] border-ink-3" key={i} />
                ))}
                {r.caption && <span className="ml-[4px] font-mono">{r.caption}</span>}
              </span>
            )}
            {r.trailing}
          </li>
        ))}
      </ul>
    </div>
  );
}
