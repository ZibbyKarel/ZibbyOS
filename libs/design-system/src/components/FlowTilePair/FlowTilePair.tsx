import type { ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";

export enum FlowTilePairTestId {
  Root = "flow-tile-pair-root",
  Trigger = "flow-tile-pair-trigger",
  Target = "flow-tile-pair-target",
  Arrow = "flow-tile-pair-arrow",
}

export interface FlowTile {
  /** Glyph or avatar in the left square. */
  icon: ReactNode;
  /** Small uppercase label ("KDY", "AGENT"). */
  kicker: string;
  title: string;
  /** Mono sub-line (cron expression, event name). */
  code?: string;
  /** Mark pinned to the right edge (engine letters). */
  badge?: ReactNode;
  testId?: string;
}

export interface FlowTilePairProps {
  trigger: FlowTile;
  target: FlowTile;
  /** Off automation: dashed arrow and dimmed tiles. */
  off?: boolean;
  ref?: Ref<HTMLDivElement>;
}

function Tile({ tile, testId }: { tile: FlowTile; testId: string }) {
  return (
    <div
      className="flex min-w-0 items-center gap-[10px] rounded-[10px] border border-line-2 bg-bg p-[12px]"
      data-testid={testId}
    >
      <span className="grid size-[32px] shrink-0 place-items-center rounded-[9px] border border-line bg-raised text-ink">
        {tile.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-px block text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
          {tile.kicker}
        </span>
        <span
          className="block truncate text-[13px] leading-[1.3] font-medium text-ink"
          data-testid={tile.testId}
        >
          {tile.title}
        </span>
        {tile.code && (
          <code className="mt-[3px] block truncate font-mono text-[11px] text-ink-3">
            {tile.code}
          </code>
        )}
      </span>
      {tile.badge}
    </div>
  );
}

/** Trigger → target tile pair joined by an arrow (design `.au-dia`); stacks with a down arrow on a phone. */
export function FlowTilePair({ trigger, target, off, ref }: FlowTilePairProps) {
  return (
    <div
      className={`grid grid-cols-1 items-stretch gap-[6px] transition-opacity md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:gap-0 ${off ? "opacity-55" : ""}`}
      data-off={off ? "true" : undefined}
      data-testid={FlowTilePairTestId.Root}
      ref={ref}
    >
      <Tile testId={FlowTilePairTestId.Trigger} tile={trigger} />
      <span
        aria-hidden="true"
        className="relative grid h-[20px] place-items-center md:hidden"
        data-testid={FlowTilePairTestId.Arrow}
      >
        <Icon name="arrow" size="sm" tone="dim" />
      </span>
      <span
        aria-hidden="true"
        className={`relative hidden md:block before:absolute before:top-[calc(50%-1px)] before:right-[10px] before:left-[4px] before:h-[2px] after:absolute after:top-[calc(50%-5px)] after:right-[4px] after:border-y-[5px] after:border-l-[7px] after:border-y-transparent ${
          off
            ? "before:bg-[repeating-linear-gradient(90deg,var(--color-line-2)_0_4px,transparent_4px_8px)] after:border-l-line-2"
            : "before:bg-ink-2 after:border-l-ink-2"
        }`}
      />
      <Tile testId={FlowTilePairTestId.Target} tile={target} />
    </div>
  );
}
