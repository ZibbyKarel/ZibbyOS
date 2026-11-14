import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum ReadingItemTestId {
  Root = "reading-item-root",
  Open = "reading-item-open",
  Text = "reading-item-text",
  Sub = "reading-item-sub",
  Action = "reading-item-action",
}

export interface ReadingItemProps {
  /** The question / statement, set in the reading type. */
  text: ReactNode;
  /** Quiet source line under the text. */
  sub?: ReactNode;
  /** Muted text (answered / agreed). */
  muted?: boolean;
  /** A quiet trailing control — a real link/button, a sibling of the open area. */
  action?: ReactNode;
  /** Unique row key (`data-rk`). */
  rowKey?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** Reading-list species item: reading-type text with a quiet source line, hairline-separated. */
export function ReadingItem({
  text,
  sub,
  muted = false,
  action,
  rowKey,
  selected = false,
  onClick,
}: ReadingItemProps) {
  const body = (
    <>
      <span
        className={cn("block text-reading [text-wrap:pretty]", muted ? "text-ink-2" : "text-ink")}
        data-testid={ReadingItemTestId.Text}
      >
        {text}
      </span>
      {sub ? (
        <span className="mt-[2px] block text-meta text-ink-3" data-testid={ReadingItemTestId.Sub}>
          {sub}
        </span>
      ) : null}
    </>
  );
  return (
    <div
      className={cn(
        "flex items-start gap-[14px] border-b border-line px-[var(--bridge-row-px)] last:border-b-0",
        selected && "ring-2 ring-inset ring-accent",
      )}
      data-rk={rowKey}
      data-testid={ReadingItemTestId.Root}
    >
      {onClick ? (
        <button
          aria-pressed={selected}
          className={cn(
            "min-w-0 flex-1 cursor-pointer appearance-none py-[calc(var(--rowpad)+4px)] text-left",
            focusRingInset,
          )}
          data-testid={ReadingItemTestId.Open}
          onClick={onClick}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1 py-[calc(var(--rowpad)+4px)]">{body}</div>
      )}
      {action ? (
        <span
          className="flex flex-none items-start pt-[calc(var(--rowpad)+2px)]"
          data-testid={ReadingItemTestId.Action}
        >
          {action}
        </span>
      ) : null}
    </div>
  );
}
