import type { ReactNode, Ref } from "react";

export enum OrgChartTestId {
  Root = "org-chart-root",
  Node = "org-chart-node",
}

export interface OrgChartProps {
  /** The root pill content (monogram + "ZibbyCorp · 6 oddělení"). */
  root: ReactNode;
  /** The grid of child cards. */
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Org-chart frame: a root pill, a stem and bracket line dropping onto the child cards (design `.dp-org`). */
export function OrgChart({ root, children, ref }: OrgChartProps) {
  return (
    <div className="flex flex-col items-stretch" data-testid={OrgChartTestId.Root} ref={ref}>
      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-[8px] rounded-full border border-line-2 bg-panel px-[10px] py-[5px] text-[12.5px] font-medium text-ink"
          data-testid={OrgChartTestId.Node}
        >
          {root}
        </span>
      </div>
      <div aria-hidden className="mx-auto h-[14px] w-px bg-line-2" />
      <div
        aria-hidden
        className="mx-[16.6%] hidden h-[12px] rounded-t-[10px] border border-b-0 border-line-2 lg:block"
      />
      <div className="pt-[2px] lg:pt-[4px]">{children}</div>
    </div>
  );
}
