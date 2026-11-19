import type { ReactNode, Ref } from "react";
import { focusRing } from "../../utils/focus";
import { cn } from "../../utils/cn";

export enum ListCardTestId {
  Root = "list-card-root",
  Open = "list-card-open",
}

export interface ListCardProps {
  children: ReactNode;
  /** Makes the whole card a click target; links/buttons inside stay independently clickable. */
  onOpen?: () => void;
  /** Accessible name of the open target. */
  openLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

/** The list-page card shell (design `.ls-card`): hairline-bordered 12px panel with a hover border. */
export function ListCard({ children, onOpen, openLabel, ref }: ListCardProps) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-[12px] border border-line bg-panel p-[18px] transition-colors",
        onOpen && "hover:border-line-2",
      )}
      data-testid={ListCardTestId.Root}
      ref={ref}
    >
      {onOpen && (
        <button
          aria-label={openLabel}
          className={cn("absolute inset-0 z-0 cursor-pointer rounded-[12px]", focusRing)}
          data-testid={ListCardTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      <div
        className={cn(
          "relative z-[1] flex min-w-0 flex-1 flex-col gap-[14px]",
          onOpen && "pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
