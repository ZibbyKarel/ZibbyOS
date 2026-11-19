import type { ReactNode, Ref } from "react";

export enum ConnectionStripTestId {
  Root = "connection-strip-root",
  Grid = "connection-strip-grid",
}

export interface ConnectionStripProps {
  /** Kicker, e.g. "Connections". */
  label: string;
  /** One-line summary next to the kicker ("4 connected · 1 needs attention"). */
  summary?: ReactNode;
  /** Legend labels for the filled / outlined tile swatches. */
  ownLabel?: string;
  inheritedLabel?: string;
  /** The inheritance ribbon, right-aligned. */
  ribbon?: ReactNode;
  /** Tiles. */
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** The connections strip under an entity header (design `.conn`): kicker, summary, legend, ribbon, tile grid. */
export function ConnectionStrip({
  label,
  summary,
  ownLabel,
  inheritedLabel,
  ribbon,
  children,
  ref,
}: ConnectionStripProps) {
  return (
    <section
      className="border-b border-line px-[28px] pt-[16px] pb-[20px]"
      data-testid={ConnectionStripTestId.Root}
      ref={ref}
    >
      <div className="mb-[12px] flex flex-wrap items-center gap-[12px] text-[12.5px] text-ink-2">
        <span className="text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
          {label}
        </span>
        {summary && <span>{summary}</span>}
        <span className="flex-1" />
        {(ownLabel || inheritedLabel) && (
          <span className="inline-flex items-center gap-[12px] text-[11.5px] text-ink-3">
            {ownLabel && (
              <span className="inline-flex items-center gap-[5px]">
                <i className="inline-block h-[10px] w-[14px] rounded-[3px] border border-line-2 bg-raised" />
                {ownLabel}
              </span>
            )}
            {inheritedLabel && (
              <span className="inline-flex items-center gap-[5px]">
                <i className="inline-block h-[10px] w-[14px] rounded-[3px] border border-ink-3" />
                {inheritedLabel}
              </span>
            )}
          </span>
        )}
        {ribbon}
      </div>
      <div
        className="grid grid-cols-2 gap-[10px] md:grid-cols-3 xl:grid-cols-6"
        data-testid={ConnectionStripTestId.Grid}
      >
        {children}
      </div>
    </section>
  );
}
