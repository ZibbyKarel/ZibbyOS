"use client";
import { type ReactNode, useId, useState } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum InspectorSectionTestId {
  Root = "inspector-section-root",
  Header = "inspector-section-header",
  Summary = "inspector-section-summary",
  Index = "inspector-section-index",
  Body = "inspector-section-body",
}

export interface InspectorSectionProps {
  title: string;
  /** One-line value shown at the right of the header while collapsed (and expanded). */
  summary?: ReactNode;
  /** Paints the summary as a problem (rose). */
  invalid?: boolean;
  /** Mono ordinal shown before the title ("1", "2", …) — numbered inspector grammar. */
  index?: number;
  /** Show the summary only while the section is collapsed. */
  hideSummaryWhenOpen?: boolean;
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Controlled state — pair with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * A collapsible section of a detail inspector: a 44px header (title, summary of the current
 * value, chevron) over a padded body. Sections stack with a hairline between them.
 */
export function InspectorSection({
  title,
  summary,
  invalid = false,
  index,
  hideSummaryWhenOpen = false,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  children,
}: InspectorSectionProps) {
  const [local, setLocal] = useState(defaultOpen);
  const open = controlled ?? local;
  const bodyId = useId();
  const showSummary = summary !== undefined && summary !== "" && !(hideSummaryWhenOpen && open);
  const toggle = () => {
    onOpenChange?.(!open);
    if (controlled === undefined) setLocal(!open);
  };
  return (
    <section className="border-b border-line" data-testid={InspectorSectionTestId.Root}>
      <button
        aria-controls={bodyId}
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center gap-2 bg-transparent px-3.5 text-left",
          "text-[12.5px] font-semibold text-ink hover:bg-panel-2",
          focusRingInset,
        )}
        data-testid={InspectorSectionTestId.Header}
        onClick={toggle}
        type="button"
      >
        {index !== undefined && (
          <span
            className="w-3.5 font-mono text-[11px] font-medium text-ink-3"
            data-testid={InspectorSectionTestId.Index}
          >
            {index}
          </span>
        )}
        <span>{title}</span>
        {showSummary && (
          <span
            className={cn(
              "ml-auto flex max-w-[190px] items-center gap-1.5 truncate text-[12px] font-normal",
              invalid ? "text-bad" : "text-ink-3",
            )}
            data-testid={InspectorSectionTestId.Summary}
          >
            {summary}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "text-ink-3 transition-transform motion-reduce:transition-none",
            showSummary ? "" : "ml-auto",
            open && "rotate-180",
          )}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          className="flex flex-col gap-3.5 px-3.5 pb-4 pt-0.5"
          data-testid={InspectorSectionTestId.Body}
          id={bodyId}
        >
          {children}
        </div>
      )}
    </section>
  );
}
