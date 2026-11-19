import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";

export enum LoopDiagramTestId {
  Root = "loop-diagram-root",
  Maker = "loop-diagram-maker",
  Verifier = "loop-diagram-verifier",
  ForwardArrow = "loop-diagram-forward-arrow",
  BackArrow = "loop-diagram-back-arrow",
  ForwardLabel = "loop-diagram-forward-label",
  BackLabel = "loop-diagram-back-label",
  Count = "loop-diagram-count",
}

/** Which arrow carries the live signal: `forward` = maker → verifier, `back` = verdict → retry. */
export type LoopDiagramActive = "forward" | "back" | null;

export interface LoopDiagramProps {
  /** The first node of the loop (its card — the diagram only lays it out). */
  maker: ReactNode;
  /** The second node of the loop. */
  verifier: ReactNode;
  /** The arrow that currently pulses violet; `null` = at rest. */
  active?: LoopDiagramActive;
  /** Dashes the back arrow — the loop is paused and waits for a person. */
  paused?: boolean;
  /** Counter in the middle ("4 / 8"). */
  count: ReactNode;
  /** Word under the counter ("iteration"). */
  countLabel: ReactNode;
  /** Caption on the forward arrow ("result → judge"). */
  forwardLabel: ReactNode;
  /** Caption on the back arrow ("verdict + feedback → retry"). */
  backLabel: ReactNode;
  /**
   * Board look: a dotted-grid backdrop, and the live arrow drawn as an animated dashed flow
   * instead of a pulsing solid line. Off by default.
   */
  board?: boolean;
  /** A small preview: narrow middle, arrows always drawn, no arrow captions. Pair with `mini` nodes. */
  mini?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const BOARD_BG =
  "bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-ink)_9%,transparent)_1px,transparent_1.4px)] bg-[length:20px_20px]";

/** Marching dashes for the live arrow of a `board` diagram. */
function Flow() {
  return (
    <animate
      attributeName="stroke-dashoffset"
      dur="1s"
      from="0"
      repeatCount="indefinite"
      to="-11"
    />
  );
}

const FORWARD = "M0,40 C30,4 70,4 100,40";
const BACK = "M100,60 C70,96 30,96 0,60";

function stroke(on: boolean) {
  return on ? "var(--color-run)" : "var(--color-ink-3)";
}

function Head({ on, className, testId }: { on: boolean; className: string; testId: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute", className)}
      data-testid={testId}
      height={9}
      viewBox="0 0 10 10"
      width={9}
    >
      <path d="M0,1 L9,5 L0,9 z" fill={stroke(on)} />
    </svg>
  );
}

/**
 * A maker ⇄ verifier loop: two node slots joined by two curved arrows, an iteration
 * counter between them. From `md` up the arrows are drawn (the active one pulses, a
 * paused loop dashes the lower one); below it the middle collapses to `⇄` + the counter.
 */
export function LoopDiagram({
  maker,
  verifier,
  active = null,
  paused = false,
  count,
  countLabel,
  forwardLabel,
  backLabel,
  board = false,
  mini = false,
  ref,
}: LoopDiagramProps) {
  const show = mini ? "block" : "hidden md:block";
  return (
    <div
      aria-label="Loop"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[6px] rounded-lg border border-line bg-bg px-[10px] py-[14px] md:min-h-[250px] md:grid-cols-[minmax(0,270px)_minmax(0,1fr)_minmax(0,270px)] md:gap-0 md:px-[40px]",
        mini &&
          "min-h-[130px] grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] gap-[4px] px-[10px] py-[10px] md:min-h-[130px] md:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] md:gap-[4px] md:px-[10px]",
        board && BOARD_BG,
      )}
      data-testid={LoopDiagramTestId.Root}
      ref={ref}
      role="group"
    >
      <div data-testid={LoopDiagramTestId.Maker}>{maker}</div>
      <div
        className={cn(
          "relative flex flex-col items-center justify-center md:h-[190px]",
          mini && "h-[90px] md:h-[90px]",
        )}
      >
        <svg
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-0 h-full w-full", show)}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path
            className={active === "forward" && !board ? "animate-pulse" : undefined}
            d={FORWARD}
            data-testid={LoopDiagramTestId.ForwardArrow}
            fill="none"
            stroke={stroke(active === "forward")}
            strokeDasharray={board && active === "forward" ? "5 6" : undefined}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          >
            {board && active === "forward" ? <Flow /> : null}
          </path>
          <path
            className={active === "back" && !board ? "animate-pulse" : undefined}
            d={BACK}
            data-testid={LoopDiagramTestId.BackArrow}
            fill="none"
            stroke={stroke(active === "back")}
            strokeDasharray={paused ? "4 4" : board && active === "back" ? "5 6" : undefined}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          >
            {board && active === "back" && !paused ? <Flow /> : null}
          </path>
        </svg>
        <span className={show}>
          <Head
            className="top-[40%] right-0 rotate-[40deg]"
            on={active === "forward"}
            testId="loop-head-forward"
          />
          <Head
            className="top-[60%] left-0 rotate-[220deg]"
            on={active === "back"}
            testId="loop-head-back"
          />
        </span>
        <span
          className={cn(
            "absolute top-[8%] hidden whitespace-nowrap rounded-full bg-bg px-[8px] text-meta text-ink-3",
            !mini && "md:block",
          )}
          data-testid={LoopDiagramTestId.ForwardLabel}
        >
          {forwardLabel}
        </span>
        <span
          className={cn(
            "absolute bottom-[6%] hidden whitespace-nowrap rounded-full bg-bg px-[8px] text-meta text-ink-3",
            !mini && "md:block",
          )}
          data-testid={LoopDiagramTestId.BackLabel}
        >
          {backLabel}
        </span>
        <span aria-hidden="true" className={cn("font-mono text-ink-3 md:hidden", mini && "hidden")}>
          ⇄
        </span>
        <div
          aria-live="polite"
          className="relative z-[1] flex flex-col items-center gap-[2px]"
          data-testid={LoopDiagramTestId.Count}
        >
          <span
            className={cn(
              "font-mono text-[18px] font-medium text-ink md:text-[22px]",
              mini && "text-[14px] md:text-[14px]",
            )}
          >
            {count}
          </span>
          <span className="text-meta text-ink-3">{countLabel}</span>
        </div>
      </div>
      <div data-testid={LoopDiagramTestId.Verifier}>{verifier}</div>
    </div>
  );
}

export enum LoopDiagramNodeTestId {
  Root = "loop-diagram-node-root",
  Kicker = "loop-diagram-node-kicker",
  Title = "loop-diagram-node-title",
  Subtitle = "loop-diagram-node-subtitle",
  Line = "loop-diagram-node-line",
}

export type LoopDiagramNodeState = "rest" | "active" | "wait";

export interface LoopDiagramNodeProps {
  /** "Maker" / "Verifier". */
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Leading mark (icon tile, avatar). */
  leading?: ReactNode;
  /** One line of what it is doing right now. */
  line?: ReactNode;
  /** `active` pulses violet, `wait` is amber. */
  state?: LoopDiagramNodeState;
  /** Makes the node a button (the edit surface); omit for a static card. */
  onClick?: () => void;
  /** Accessible name of the button ("Maker: Writer Dev. Change maker"). */
  ariaLabel?: string;
  /** Preview size: tighter padding, smaller text, no status line. */
  mini?: boolean;
}

const NODE_STATE: Record<LoopDiagramNodeState, string> = {
  rest: "border-line-2",
  active: "animate-pulse border-run/70",
  wait: "border-warn/70",
};

/** A node card for {@link LoopDiagram}: kicker, title/subtitle, a status line; a button when `onClick` is set. */
export function LoopDiagramNode({
  kicker,
  title,
  subtitle,
  leading,
  line,
  state = "rest",
  onClick,
  ariaLabel,
  mini = false,
}: LoopDiagramNodeProps) {
  const body = (
    <>
      <span
        className="text-[11px] font-medium tracking-[0.06em] text-ink-3 uppercase"
        data-testid={LoopDiagramNodeTestId.Kicker}
      >
        {kicker}
      </span>
      <span className="flex items-center gap-[10px]">
        {leading}
        <span className="min-w-0">
          <b
            className="block truncate text-body font-semibold text-ink"
            data-testid={LoopDiagramNodeTestId.Title}
          >
            {title}
          </b>
          {subtitle ? (
            <small
              className="block truncate text-meta text-ink-3"
              data-testid={LoopDiagramNodeTestId.Subtitle}
            >
              {subtitle}
            </small>
          ) : null}
        </span>
      </span>
      {line && !mini ? (
        <span
          className="flex items-center gap-[6px] border-t border-line pt-[9px] text-meta text-ink-2"
          data-testid={LoopDiagramNodeTestId.Line}
        >
          {line}
        </span>
      ) : null}
    </>
  );
  const cls = cn(
    "flex w-full min-w-0 flex-col gap-[10px] rounded-[14px] border bg-panel p-[14px] text-left",
    mini && "gap-[4px] rounded-[10px] p-[8px] text-[11px]",
    NODE_STATE[state],
  );
  return onClick ? (
    <button
      aria-label={ariaLabel}
      className={cn(cls, "cursor-pointer hover:border-ink-3")}
      data-testid={LoopDiagramNodeTestId.Root}
      onClick={onClick}
      type="button"
    >
      {body}
    </button>
  ) : (
    <div className={cls} data-testid={LoopDiagramNodeTestId.Root}>
      {body}
    </div>
  );
}
