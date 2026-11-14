import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum BoardTagTestId {
  Root = "board-tag-root",
}

export interface BoardTagProps extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
  /** `you` — amber "needs you" pill (Bridge `.you`); `source` — neutral source chip. */
  variant: "you" | "source";
  children?: ReactNode;
  ref?: Ref<HTMLSpanElement>;
}

/** A small tag: `You · 2h` (amber pill) or a neutral source chip (`Jira`, `GitHub`). */
export function BoardTag({ variant, children, ref, ...props }: BoardTagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] flex-none items-center font-sans text-[11.5px] whitespace-nowrap",
        variant === "you"
          ? "rounded-full bg-accent/15 px-2 font-medium text-accent-fg"
          : "rounded-sm bg-ink/[0.045] px-[7px] text-ink-2",
      )}
      data-testid={BoardTagTestId.Root}
      ref={ref}
      {...props}
    >
      {children}
    </span>
  );
}
