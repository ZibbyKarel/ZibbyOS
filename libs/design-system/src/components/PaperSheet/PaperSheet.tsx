import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Checkbox } from "../Checkbox/Checkbox";

export enum PaperSheetTestId {
  Root = "paper-sheet-root",
  Line = "paper-sheet-line",
  Text = "paper-sheet-text",
  Mention = "paper-sheet-mention",
  Action = "paper-sheet-action",
  Add = "paper-sheet-add",
}

export interface PaperSheetProps {
  children?: ReactNode;
}

/** Paper species surface: `--color-paper` with a faint ruled line every 34px (the line rows' height). */
export function PaperSheet({ children }: PaperSheetProps) {
  return (
    <div
      className={cn(
        "min-h-full bg-paper",
        "bg-[image:repeating-linear-gradient(180deg,transparent_0_33px,color-mix(in_srgb,var(--color-ink)_3.5%,transparent)_33px_34px)]",
      )}
      data-testid={PaperSheetTestId.Root}
    >
      {children}
    </div>
  );
}

const MENTION = /((?<![\p{L}\p{N}])@[\p{L}\p{N}_-]+)/u;

export interface PaperLineProps {
  text: string;
  /** Accessible name of the checkbox. */
  checkLabel: string;
  onCheck: () => void;
  /** Trailing controls (shown quietly). */
  action?: ReactNode;
  /** Unique row key (`data-rk`). */
  rowKey?: string;
}

/** One ruled line: checkbox, text with `@mentions` in sky, trailing action. */
export function PaperLine({ text, checkLabel, onCheck, action, rowKey }: PaperLineProps) {
  return (
    <div
      className="flex min-h-[34px] items-center gap-[10px] px-[12px]"
      data-rk={rowKey}
      data-testid={PaperSheetTestId.Line}
    >
      <Checkbox checked={false} label={checkLabel} onChange={onCheck} size="sm" />
      <span
        className="min-w-0 flex-1 truncate text-body text-ink"
        data-testid={PaperSheetTestId.Text}
      >
        {text.split(MENTION).map((part, i) =>
          i % 2 === 1 ? (
            <span
              className="text-[color:var(--color-state-think)]"
              data-testid={PaperSheetTestId.Mention}
              key={i}
            >
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
      {action ? (
        <span className="flex flex-none" data-testid={PaperSheetTestId.Action}>
          {action}
        </span>
      ) : null}
    </div>
  );
}

export interface PaperAddProps {
  children?: ReactNode;
}

/** The inline add row at the end of the sheet (hosts the composer). */
export function PaperAdd({ children }: PaperAddProps) {
  return (
    <div className="flex min-h-[34px] items-center px-[12px]" data-testid={PaperSheetTestId.Add}>
      {children}
    </div>
  );
}
