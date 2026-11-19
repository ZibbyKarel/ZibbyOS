import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";
import { type DotTone, StatusDot } from "../StatusDot/StatusDot";

export enum ConnectionTileTestId {
  Root = "connection-tile-root",
  Status = "connection-tile-status",
  Source = "connection-tile-source",
  Add = "connection-tile-add",
}

export type ConnectionTileOrigin = "own" | "inherited";
export type ConnectionTileHealth = "ok" | "warn" | "bad" | "off";

const dotTone: Record<ConnectionTileHealth, DotTone> = {
  ok: "done",
  warn: "blocked",
  bad: "error",
  off: "idle",
};
const statusText: Record<ConnectionTileHealth, string> = {
  ok: "text-ink-2",
  warn: "text-accent-fg",
  bad: "text-bad",
  off: "text-ink-3",
};

export interface ConnectionTileProps {
  /** Brand mark (an `IconTile` with the service's logo / glyph). */
  mark: ReactNode;
  name: string;
  /** Status line copy, e.g. "Connected", "Expires in 6 d", "Token revoked". */
  status: string;
  health: ConnectionTileHealth;
  /** Mono meta lines under the status (last sync, scope, ...). */
  meta?: string[];
  /** `own` = filled with an accent edge, `inherited` = outlined. */
  origin: ConnectionTileOrigin;
  /** Footer chip for an own tile ("Own"). */
  ownLabel?: string;
  /** Footer chip for an inherited tile ("From Acme Logistics"). */
  sourceLabel?: string;
  /** Footer caption next to the own chip ("→ 4 projects"). */
  serves?: string;
  /** CSS colour of the own tile's accent edge. */
  accent?: string;
  onClick?: () => void;
  ref?: Ref<HTMLElement>;
}

/** One connection of the strip (design `.ct`): who owns it, its health and what it reaches. */
export function ConnectionTile({
  mark,
  name,
  status,
  health,
  meta = [],
  origin,
  ownLabel = "Own",
  sourceLabel,
  serves,
  accent,
  onClick,
  ref,
}: ConnectionTileProps) {
  const own = origin === "own";
  const cls = cn(
    "relative flex min-h-[118px] min-w-0 flex-col gap-[8px] rounded-[12px] border px-[12px] pt-[12px] pb-[11px] text-left text-ink",
    own ? "border-line-2 bg-panel-2" : "border-line-2 bg-transparent",
    health === "bad" && "border-bad/55",
    health === "bad" && own && "bg-bad/[0.06]",
    onClick && cn("cursor-pointer hover:border-ink-3", focusRing),
  );
  const style: CSSProperties | undefined =
    own && accent
      ? { boxShadow: `inset 0 2px 0 color-mix(in srgb, ${accent} 75%, transparent)` }
      : undefined;
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-[9px]">
        {mark}
        <b className="min-w-0 flex-1 truncate text-[13px] font-semibold">{name}</b>
      </span>
      <span className="flex min-w-0 flex-col gap-[2px] font-mono text-[11px] text-ink-3">
        <span
          className={cn("flex items-center gap-[7px] font-sans text-[12px]", statusText[health])}
          data-testid={ConnectionTileTestId.Status}
        >
          <StatusDot size="75" tone={dotTone[health]} />
          {status}
        </span>
        {meta.map((m) => (
          <span className="truncate" key={m}>
            {m}
          </span>
        ))}
      </span>
      <span
        className="mt-auto flex min-w-0 items-center gap-[6px] text-[11.5px] whitespace-nowrap text-ink-3"
        data-testid={ConnectionTileTestId.Source}
      >
        {own ? (
          <>
            <span className="inline-flex h-[20px] items-center rounded-[6px] bg-ink px-[7px] text-[11px] font-medium text-on-ink">
              {ownLabel}
            </span>
            {serves && <span className="truncate">{serves}</span>}
          </>
        ) : (
          <span className="inline-flex h-[20px] items-center gap-[5px] rounded-[6px] border border-line-2 px-[7px] text-[11px] text-ink-2">
            <Icon name="building" size="xs" />
            {sourceLabel}
          </span>
        )}
      </span>
    </>
  );
  return onClick ? (
    <button
      className={cls}
      data-testid={ConnectionTileTestId.Root}
      onClick={onClick}
      ref={ref as Ref<HTMLButtonElement>}
      style={style}
      type="button"
    >
      {body}
    </button>
  ) : (
    <div
      className={cls}
      data-testid={ConnectionTileTestId.Root}
      ref={ref as Ref<HTMLDivElement>}
      style={style}
    >
      {body}
    </div>
  );
}

export interface ConnectionAddTileProps {
  label: string;
  hint?: string;
  onClick: () => void;
}

/** The dashed "Connect" tile that ends the strip. */
export function ConnectionAddTile({ label, hint, onClick }: ConnectionAddTileProps) {
  return (
    <button
      className={cn(
        "flex min-h-[118px] min-w-0 cursor-pointer flex-col justify-center gap-[6px] rounded-[12px] border-[1.5px] border-dashed border-line-2 bg-transparent px-[12px] text-left text-ink-2 hover:border-accent hover:text-ink",
        focusRing,
      )}
      data-testid={ConnectionTileTestId.Add}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-[32px] w-[32px] place-items-center rounded-[9px] bg-accent/[0.12] text-accent-fg">
        <Icon name="plus" size="md" stroke="medium" />
      </span>
      <b className="text-[13px] font-semibold text-ink">{label}</b>
      {hint && <small className="text-[11.5px] leading-[1.4] text-ink-3">{hint}</small>}
    </button>
  );
}
