import type { HTMLAttributes, Ref } from "react";
import { cn } from "../../utils/cn";

export enum KbdTestId {
  Root = "kbd-root",
}

export interface KbdProps extends Omit<HTMLAttributes<HTMLElement>, "className"> {
  ref?: Ref<HTMLElement>;
}

export function Kbd({ ref, children, ...rest }: KbdProps) {
  return (
    <kbd
      data-testid={KbdTestId.Root}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px]",
        "font-mono text-[10.5px] leading-none",
        "text-ink-3 border border-line-2 rounded-[4px]",
      )}
      ref={ref as Ref<HTMLElement>}
    >
      {children}
    </kbd>
  );
}
