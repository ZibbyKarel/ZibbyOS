import type { Ref } from "react";

export enum PluginShelfTestId {
  Root = "plugin-shelf-root",
  Installed = "plugin-shelf-installed",
  Available = "plugin-shelf-available",
  More = "plugin-shelf-more",
}

export interface PluginShelfProps {
  /** Plugins in the catalog. */
  total: number;
  /** How many of them are installed. */
  installed: number;
  /** Optional short labels per box (e.g. 2-letter codes), installed ones first. */
  labels?: string[];
  /** Max boxes drawn before the `+N` overflow. Default 6. */
  max?: number;
  ref?: Ref<HTMLDivElement>;
}

const HEIGHTS = ["h-[40px]", "h-[50px]", "h-[36px]", "h-[46px]", "h-[32px]", "h-[44px]"];

/**
 * Seznamy marketplace "shelf": the catalog drawn as a row of little product boxes
 * standing on a shelf line — installed = filled, available = dashed, `+N` for the
 * rest. Counts only; decorative (`aria-hidden`), the card carries the real numbers.
 */
export function PluginShelf({ total, installed, labels, max = 6, ref }: PluginShelfProps) {
  const shown = Math.min(total, max);
  const filled =
    total === 0
      ? 0
      : Math.min(shown, installed > 0 ? Math.max(1, Math.round((installed / total) * shown)) : 0);
  return (
    <div
      aria-hidden="true"
      className="flex h-[88px] items-end gap-[6px] rounded-t-[11px] border-b-2 border-line-2 bg-gradient-to-b from-transparent to-ink/[0.035] px-[16px] pb-[10px]"
      data-testid={PluginShelfTestId.Root}
      ref={ref}
    >
      {Array.from({ length: shown }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            className={`grid w-[32px] place-items-center rounded-[7px] font-mono text-[9.5px] font-semibold ${HEIGHTS[i % HEIGHTS.length]} ${
              on
                ? "border border-line-2 bg-raised text-ink"
                : "border border-dashed border-line-2 text-ink-3"
            }`}
            data-testid={on ? PluginShelfTestId.Installed : PluginShelfTestId.Available}
            key={i}
          >
            {labels?.[i]}
          </span>
        );
      })}
      {total > shown && (
        <span
          className="ml-1 self-center text-[11px] text-ink-3"
          data-testid={PluginShelfTestId.More}
        >{`+${total - shown}`}</span>
      )}
    </div>
  );
}
