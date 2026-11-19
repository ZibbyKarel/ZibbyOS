import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import type { SubNavLinkComponent } from "../SubNav/SubNav";
import type { SegmentedBarTone } from "../SegmentedBar/SegmentedBar";

export enum CountGridTestId {
  Root = "count-grid-root",
  Cell = "count-grid-cell",
}

export interface CountGridItem {
  id: string;
  label: ReactNode;
  value: number | string;
  /** Colour of the 7px square before the label; omit for none. */
  tone?: SegmentedBarTone;
  href?: string;
  testId?: string;
}

export interface CountGridProps {
  items: readonly CountGridItem[];
  /** Router-aware anchor (next/link). */
  linkComponent?: SubNavLinkComponent;
  ref?: Ref<HTMLDivElement>;
}

const SQ: Record<SegmentedBarTone, string> = {
  run: "bg-run",
  warn: "bg-warn",
  ok: "bg-ok",
  bad: "bg-bad",
  idle: "bg-ink-3",
};

/** 3-column label/number grid whose cells deep-link (design `.pj-c`). */
export function CountGrid({ items, linkComponent, ref }: CountGridProps) {
  const Link = linkComponent ?? "a";
  return (
    <div
      className="-mx-[6px] grid grid-cols-3 gap-x-[4px] gap-y-[2px]"
      data-testid={CountGridTestId.Root}
      ref={ref}
    >
      {items.map((it) => {
        const body = (
          <>
            <span className="inline-flex items-center gap-[5px] overflow-hidden whitespace-nowrap">
              {it.tone && <i className={cn("size-[7px] shrink-0 rounded-[2px]", SQ[it.tone])} />}
              {it.label}
            </span>
            <b
              className={cn(
                "font-mono text-[12.5px] font-medium tabular-nums",
                it.value === 0 || it.value === "0" ? "font-normal text-ink-3" : "text-ink",
              )}
            >
              {it.value}
            </b>
          </>
        );
        const cls = cn(
          "flex h-[26px] items-center justify-between gap-[6px] rounded-[7px] px-[6px] text-[11.5px] text-ink-2 no-underline hover:bg-ink/5 hover:text-ink",
          focusRing,
        );
        return it.href ? (
          <Link
            className={cls}
            data-testid={it.testId ?? CountGridTestId.Cell}
            href={it.href}
            key={it.id}
          >
            {body}
          </Link>
        ) : (
          <div className={cls} data-testid={it.testId ?? CountGridTestId.Cell} key={it.id}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
