import type { Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";

export enum ZibbyToastTestId {
  Root = "zibby-toast-root",
  Message = "zibby-toast-message",
  Action = "zibby-toast-action",
}

export interface ZibbyToastProps {
  message: string;
  /** Label of the trailing action (the 5-second "Undo"). Absent hides the button. */
  actionLabel?: string;
  onAction?: () => void;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The inverted ink pill that confirms an overlay action (`.ztoast`). Presentational only:
 * the app owns the auto-dismiss timer and the overlay owns the position.
 */
export function ZibbyToast({ message, actionLabel, onAction, ref }: ZibbyToastProps) {
  const hasAction = actionLabel != null && actionLabel !== "";
  return (
    <div
      className={cn(
        "inline-flex h-[38px] items-center gap-3 whitespace-nowrap rounded-full bg-ink text-[13px] text-on-ink",
        "shadow-[var(--shadow-pop)] animate-fade-in motion-reduce:animate-none",
        hasAction ? "pr-[6px] pl-4" : "px-4",
      )}
      data-testid={ZibbyToastTestId.Root}
      ref={ref}
      role="status"
    >
      <span data-testid={ZibbyToastTestId.Message}>{message}</span>
      {hasAction && (
        <button
          className={cn(
            "h-7 cursor-pointer rounded-full border-none px-3 font-sans text-[13px] font-semibold text-on-ink",
            "bg-on-ink/[0.16] transition-colors hover:bg-on-ink/[0.24] motion-reduce:transition-none",
            "outline-none focus-visible:ring-2 focus-visible:ring-accent",
          )}
          data-testid={ZibbyToastTestId.Action}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
