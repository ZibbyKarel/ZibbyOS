import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum IndentRailTestId {
  Root = "indent-rail",
}

const VARIANT = {
  rail: "ml-5 border-l border-line-2",
  /**
   * The redesign's stack connector: a `line-2` spine under the parent's 20px glyph and a 9px
   * elbow into each child row (`[data-rk]`) at the height of its first line.
   */
  stack: cn(
    "relative ml-[19px] pl-[12px]",
    "before:absolute before:top-[-4px] before:bottom-[20px] before:left-0 before:w-px before:bg-line-2 before:content-['']",
    "[&>[data-rk]]:before:absolute [&>[data-rk]]:before:top-[calc(var(--rowpad)+10px)] [&>[data-rk]]:before:left-[-12px] [&>[data-rk]]:before:h-px [&>[data-rk]]:before:w-[9px] [&>[data-rk]]:before:bg-line-2 [&>[data-rk]]:before:content-['']",
  ),
} as const;

export interface IndentRailProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  /** `rail` (default): a hairline rail; `stack`: spine + elbow connectors (stacked PRs). */
  variant?: keyof typeof VARIANT;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** A nested block indented 20px behind a hairline rail — children of a parent row (stacked PRs). */
export function IndentRail({ variant = "rail", children, ref, ...props }: IndentRailProps) {
  return (
    <div
      className={cn("flex flex-col", VARIANT[variant])}
      data-testid={IndentRailTestId.Root}
      data-variant={variant}
      ref={ref}
      {...props}
    >
      {children}
    </div>
  );
}
