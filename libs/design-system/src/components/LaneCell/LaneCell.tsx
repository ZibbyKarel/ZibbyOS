import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum LaneCellTestId {
  Root = "lane-cell-root",
  Empty = "lane-cell-empty",
}

export type LaneCellTone = "neutral" | "semi" | "auto";

const dropClass: Record<LaneCellTone, string> = {
  neutral: "border-line-2 bg-ink/[0.04]",
  semi: "border-state-work/50 bg-state-work/[0.06]",
  auto: "border-accent/55 bg-accent/[0.06]",
};

export interface LaneCellProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  tone?: LaneCellTone;
  /** A valid drop target is being hovered: dashed tinted frame. */
  dropTarget?: boolean;
  /** The lane is above the current mode: hatched. */
  capped?: boolean;
  /** Text when there is no chip. */
  empty?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** One lane of one scope row: a wrapping chip area that can take a drag (`onDragOver` / `onDrop`). */
export function LaneCell({
  tone = "neutral",
  dropTarget = false,
  capped = false,
  empty,
  children,
  ref,
  ...rest
}: LaneCellProps) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap content-center gap-1.5 rounded-[9px] border border-dashed border-transparent p-1.5 transition-colors motion-reduce:transition-none",
        capped &&
          "bg-[repeating-linear-gradient(135deg,transparent_0_7px,color-mix(in_srgb,var(--color-ink)_3.5%,transparent)_7px_8px)]",
        dropTarget && dropClass[tone],
      )}
      data-capped={capped || undefined}
      data-drop-target={dropTarget || undefined}
      data-testid={LaneCellTestId.Root}
      ref={ref}
      {...rest}
    >
      {children}
      {!hasChildren && empty && (
        <span className="pl-1 text-[11.5px] text-ink-3" data-testid={LaneCellTestId.Empty}>
          {empty}
        </span>
      )}
    </div>
  );
}
