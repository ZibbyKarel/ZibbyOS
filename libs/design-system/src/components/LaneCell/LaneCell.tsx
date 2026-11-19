import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum LaneCellTestId {
  Root = "lane-cell-root",
}

export interface LaneCellProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  /** The lane is held by something above it (Zibby paused): hatched, chips dimmed. */
  capped?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** One lane of one scope row: a wrapping area for capability chips (give it `role="group"` + a label). */
export function LaneCell({ capped = false, children, ref, ...rest }: LaneCellProps) {
  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap content-center items-center gap-1.5 rounded-[9px] p-1.5",
        capped &&
          "bg-[repeating-linear-gradient(135deg,transparent_0_7px,color-mix(in_srgb,var(--color-ink)_3.5%,transparent)_7px_8px)] [&_button]:opacity-55",
      )}
      data-capped={capped || undefined}
      data-testid={LaneCellTestId.Root}
      ref={ref}
      {...rest}
    >
      {children}
    </div>
  );
}
