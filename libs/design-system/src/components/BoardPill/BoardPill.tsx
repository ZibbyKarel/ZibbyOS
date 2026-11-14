import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum BoardPillTestId {
  Root = "board-pill-root",
}

/**
 * `you` = waits for the operator (amber fill, the row's one amber element); `blocked` = amber
 * text on the amber tint; `error` / `done` = rose / emerald tint; `neutral` = an ink tint.
 */
export type BoardPillTone = "you" | "blocked" | "error" | "done" | "neutral";

const TONE: Record<BoardPillTone, string> = {
  you: "bg-accent font-medium text-accent-contrast",
  blocked: "bg-accent-dim text-accent-fg",
  error: "bg-[color-mix(in_srgb,var(--color-state-err)_10%,transparent)] text-state-err",
  done: "bg-[color-mix(in_srgb,var(--color-state-done)_9%,transparent)] text-state-done",
  neutral: "bg-[color-mix(in_srgb,var(--color-ink)_4.5%,transparent)] text-ink-2",
};

export interface BoardPillProps extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
  tone: BoardPillTone;
  children?: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

/** A small sentence-case state pill at the end of a row (`Tvoje review`, `Schváleno`). */
export function BoardPill({ tone, children, ref, ...props }: BoardPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 flex-none items-center gap-[5px] rounded-[6px] px-[7px] text-[11.5px] whitespace-nowrap",
        TONE[tone],
      )}
      data-testid={BoardPillTestId.Root}
      ref={ref}
      {...props}
    >
      {children}
    </span>
  );
}
