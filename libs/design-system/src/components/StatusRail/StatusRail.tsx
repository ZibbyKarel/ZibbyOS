import type { ReactNode } from "react";
import type { StateTone } from "../../stateTone";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";

export enum StatusRailTestId {
  Root = "status-rail-root",
  Item = "status-rail-item",
  Dot = "status-rail-dot",
  Title = "status-rail-title",
  Sub = "status-rail-sub",
  Time = "status-rail-time",
  Now = "status-rail-now",
  NowAside = "status-rail-now-aside",
  Park = "status-rail-park",
  ParkWhy = "status-rail-park-why",
  ParkActions = "status-rail-park-actions",
}

/** Fill per state (spec "Stav → tón"): violet working, sky thinking, amber blocked, rose, emerald, hollow idle. */
const DOT: Record<StateTone, string> = {
  working: "bg-[var(--color-state-work)] animate-zb-live motion-reduce:animate-none",
  thinking: "bg-[var(--color-state-think)] animate-zb-live motion-reduce:animate-none",
  blocked:
    "bg-[var(--color-state-block)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-state-block)_18%,transparent)]",
  error: "bg-[var(--color-state-err)]",
  done: "bg-[var(--color-state-done)]",
  idle: "border-[1.5px] border-solid border-[var(--color-state-idle)] bg-transparent",
};

export interface StateDotProps {
  tone: StateTone;
  /** `sm` 7px (tiles), `md` 8px (rails). Default `md`. */
  size?: "sm" | "md";
  /** Accessible name — without it the dot is decorative. */
  label?: string;
}

/** A round state dot: pulsing violet = running, hollow grey = idle / queued. `motion-reduce` stops the pulse. */
export function StateDot({ tone, size = "md", label }: StateDotProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "box-border inline-block flex-none rounded-full",
        size === "sm" ? "size-[7px]" : "size-[8px]",
        DOT[tone],
      )}
      data-state={tone}
      data-testid={StatusRailTestId.Dot}
      role={label ? "img" : undefined}
      title={label}
    />
  );
}

export interface StatusRailProps {
  children?: ReactNode;
}

/** The vertical axis: its `StatusRailItem`s are joined by a hairline between their dots (outside it, items stand alone). */
export function StatusRail({ children }: StatusRailProps) {
  return (
    <div
      className="flex flex-col [&>*:not(:last-child)_[data-rail-line]]:block"
      data-testid={StatusRailTestId.Root}
    >
      {children}
    </div>
  );
}

export interface StatusRailItemProps {
  tone: StateTone;
  /** Accessible name of the state dot. */
  toneLabel?: string;
  title: ReactNode;
  /** Second line (kind, step), meta voice. */
  sub?: ReactNode;
  /** Right column, mono (age, clock time). */
  time?: ReactNode;
  /** Quieter title (finished rows). */
  dim?: boolean;
  /** Extra content under the sub line (e.g. a progress bar). */
  children?: ReactNode;
  /** Unique row key (`data-rk`) — keyboard navigation and the sheet anchor use it. */
  rowKey?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** One rail entry: state dot on the axis, title + sub, mono time. A button when clickable. */
export function StatusRailItem({
  tone,
  toneLabel,
  title,
  sub,
  time,
  dim = false,
  children,
  rowKey,
  selected = false,
  onClick,
}: StatusRailItemProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "relative grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-[8px] rounded-[8px] py-[var(--rowpad)] pr-[4px] text-left",
        onClick && cn("cursor-pointer appearance-none hover:bg-ink/[0.03]", focusRingInset),
        selected && "ring-2 ring-inset ring-accent",
      )}
      data-rk={rowKey}
      data-testid={StatusRailTestId.Item}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span className="flex justify-center pt-[6px]">
        <StateDot label={toneLabel} tone={tone} />
      </span>
      {/* Connector to the next item's dot — shown by `StatusRail`, never after its last item. */}
      <span
        aria-hidden
        data-rail-line
        className="absolute bottom-[calc(-1*var(--rowpad)-2px)] left-[13.5px] top-[calc(var(--rowpad)+18px)] hidden w-px bg-line-2"
      />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn("block min-w-0 truncate text-body", dim ? "text-ink-2" : "text-ink")}
          data-testid={StatusRailTestId.Title}
        >
          {title}
        </span>
        {sub ? (
          <span className="block truncate text-meta text-ink-3" data-testid={StatusRailTestId.Sub}>
            {sub}
          </span>
        ) : null}
        {children}
      </span>
      <span
        className="whitespace-nowrap pt-[2px] font-mono text-mono tabular-nums text-ink-3"
        data-testid={StatusRailTestId.Time}
      >
        {time}
      </span>
    </Tag>
  );
}

export interface StatusRailNowProps {
  /** The one-line "now" state (e.g. "Nothing running") — omit when `children` carry the rows. */
  label?: ReactNode;
  /** Tone of the line's dot. Default `idle`. */
  tone?: StateTone;
  /** Right-aligned mono note ("next in 11 min"). */
  aside?: ReactNode;
  /** The running rows. */
  children?: ReactNode;
}

/** The "Now" block at the top of a status rail: a softly tinted box with the running rows or one idle line. */
export function StatusRailNow({ label, tone = "idle", aside, children }: StatusRailNowProps) {
  return (
    <div
      className="my-[2px] mb-[4px] flex flex-col rounded-[8px] bg-ink/[0.025] px-[6px] py-[2px]"
      data-testid={StatusRailTestId.Now}
    >
      {label ? (
        <span className="flex items-center gap-[8px] px-[4px] py-[6px] text-meta text-ink-2">
          <StateDot tone={tone} />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {aside ? (
            <span
              className="whitespace-nowrap font-mono text-mono text-ink-3"
              data-testid={StatusRailTestId.NowAside}
            >
              {aside}
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export interface StatusRailParkProps {
  title: ReactNode;
  /** Kind / step line under the title. */
  sub?: ReactNode;
  /** Why it waits for the operator. */
  why?: ReactNode;
  time?: ReactNode;
  /** Inline actions — siblings of the clickable head, never inside it. */
  actions?: ReactNode;
  /** Accessible name of the amber dot. */
  toneLabel?: string;
  rowKey?: string;
  selected?: boolean;
  onClick?: () => void;
}

/** A parked / waiting-for-you run: an amber action block (title, why, actions). */
export function StatusRailPark({
  title,
  sub,
  why,
  time,
  actions,
  toneLabel,
  rowKey,
  selected = false,
  onClick,
}: StatusRailParkProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <div
      className={cn(
        "my-[4px] rounded-[9px] border border-solid border-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_6%,transparent)]",
        selected && "ring-2 ring-accent",
      )}
      data-testid={StatusRailTestId.Park}
    >
      <Tag
        aria-pressed={onClick ? selected : undefined}
        className={cn(
          "flex w-full flex-col rounded-[9px] px-[12px] pb-[6px] pt-[10px] text-left",
          onClick && cn("cursor-pointer appearance-none", focusRingInset),
        )}
        data-rk={rowKey}
        data-testid={StatusRailTestId.Item}
        onClick={onClick}
        type={onClick ? "button" : undefined}
      >
        <span className="flex min-w-0 items-center gap-[8px] text-body font-medium text-ink">
          <StateDot label={toneLabel} tone="blocked" />
          <span className="min-w-0 flex-1 truncate" data-testid={StatusRailTestId.Title}>
            {title}
          </span>
          {time ? (
            <span
              className="whitespace-nowrap font-mono text-mono font-normal text-ink-3"
              data-testid={StatusRailTestId.Time}
            >
              {time}
            </span>
          ) : null}
        </span>
        {sub ? (
          <span
            className="block truncate pl-[16px] text-meta text-ink-3"
            data-testid={StatusRailTestId.Sub}
          >
            {sub}
          </span>
        ) : null}
        {why ? (
          <span
            className="mt-[6px] block pl-[16px] text-meta text-ink-2 [text-wrap:pretty]"
            data-testid={StatusRailTestId.ParkWhy}
          >
            {why}
          </span>
        ) : null}
      </Tag>
      {actions ? (
        <div
          className="flex flex-wrap gap-[6px] px-[12px] pb-[10px] pl-[28px] pt-[4px]"
          data-testid={StatusRailTestId.ParkActions}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
