import type { ReactNode, Ref } from "react";
import type { IconName } from "../../assets/icons";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum SummaryRowTestId {
  Root = "summary-row-root",
  Label = "summary-row-label",
  Value = "summary-row-value",
}

export interface SummaryRowProps {
  icon: IconName;
  label: string;
  /** Short state on the right ("1 failing", "3 open"). */
  value?: ReactNode;
  /** Whether what the row stands for is open below it (`aria-expanded`). */
  expanded?: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A one-line summary of something folded away — icon, label, short state, chevron
 * (phone Bridge "Other" section, spec §6). A tap opens / closes it.
 */
export function SummaryRow({
  icon,
  label,
  value,
  expanded = false,
  onClick,
  ref,
}: SummaryRowProps) {
  return (
    <button
      aria-expanded={expanded}
      className={cn(
        "grid w-full cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto_14px] items-center gap-[10px] border-0 border-b border-solid border-line bg-transparent px-[8px] py-[12px] text-left font-sans text-ink-2 last:border-b-0",
        focusRingInset,
      )}
      data-testid={SummaryRowTestId.Root}
      onClick={onClick}
      ref={ref}
      type="button"
    >
      <span className="flex text-ink-3">
        <Icon name={icon} size="sm" />
      </span>
      <span
        className="min-w-0 truncate text-[13px] font-medium text-ink"
        data-testid={SummaryRowTestId.Label}
      >
        {label}
      </span>
      <span
        className="inline-flex items-center gap-[6px] text-[12px] text-ink-3"
        data-testid={SummaryRowTestId.Value}
      >
        {value}
      </span>
      <span
        className={cn(
          "flex text-ink-3 transition-transform duration-150 motion-reduce:transition-none",
          expanded && "rotate-90",
        )}
      >
        <Icon name="chevron" size="sm" />
      </span>
    </button>
  );
}
