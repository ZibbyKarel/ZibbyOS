import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum StatusBadgeTestId {
  Root = "status-badge-root",
}

export type StatusBadgeTone = "ok" | "wait" | "off" | "err" | "info";

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
  /** ok = healthy, wait = waits for you, off = disabled (hollow dot), err = failed, info = neutral news. */
  tone?: StatusBadgeTone;
  /** Hide the leading dot. */
  noDot?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

const toneClass: Record<StatusBadgeTone, string> = {
  ok: "bg-ok/11 text-ok",
  wait: "bg-warn/14 text-warn",
  off: "bg-ink/6 text-ink-2",
  err: "bg-bad/11 text-bad",
  info: "bg-state-think/12 text-state-think",
};

/** Settings vocabulary pill (Bridge `.bdg`): dot + word — ok / waits for you / off / error / info. */
export function StatusBadge({
  tone = "ok",
  noDot = false,
  children,
  ref,
  ...rest
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-[6px] rounded-full px-[8px] text-[11.5px] font-medium whitespace-nowrap",
        toneClass[tone],
      )}
      data-testid={StatusBadgeTestId.Root}
      data-tone={tone}
      ref={ref}
      {...rest}
    >
      {!noDot && (
        <span
          aria-hidden="true"
          className={cn(
            "box-border size-[6px] shrink-0 rounded-full",
            tone === "off" ? "border-[1.5px] border-current" : "bg-current",
          )}
        />
      )}
      {children}
    </span>
  );
}
