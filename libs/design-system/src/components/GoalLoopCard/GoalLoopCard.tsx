import type { HTMLAttributes, ReactNode, Ref } from "react";
import { type StateTone, stateToneVar } from "../../stateTone";
import { Avatar } from "../Avatar/Avatar";
import { SegmentedRing } from "../SegmentedRing/SegmentedRing";

export enum GoalLoopCardTestId {
  Root = "goal-loop-card-root",
  Open = "goal-loop-card-open",
  State = "goal-loop-card-state",
  Budget = "goal-loop-card-budget",
  Title = "goal-loop-card-title",
  Maker = "goal-loop-card-maker",
  Verifier = "goal-loop-card-verifier",
  Verdict = "goal-loop-card-verdict",
  Actions = "goal-loop-card-actions",
}

export interface GoalLoopCardParty {
  name: string;
  /** Small uppercase role label above the name (`"Maker"`, `"Verifier"`). */
  role: string;
}

export interface GoalLoopCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "title"
> {
  state: StateTone;
  stateLabel: string;
  title: string;
  used: number;
  max: number;
  /** Ring caption, e.g. `"z 12 iterací"`. */
  ringCaption: string;
  ringAriaLabel: string;
  /** Top-right text, e.g. `"58 % rozpočtu iterací"`. */
  budgetLabel: string;
  maker: GoalLoopCardParty;
  verifier: GoalLoopCardParty;
  /** Verdict box. `head` is the grey lead-in (`"Verdikt · iterace 7"`), `status` the coloured word. */
  verdict: { head: string; status?: string; text: string };
  /** Colour of the verdict box's left border and status word. */
  verdictTone?: "idle" | "blocked" | "error" | "done";
  /** Action row (buttons). Sits above the card's open target. */
  actions?: ReactNode;
  /** Whole-card open target (accessible name `openLabel`). */
  onOpen?: () => void;
  openLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

const verdictBorder = {
  idle: "border-l-line-2",
  blocked: "border-l-warn",
  error: "border-l-bad",
  done: "border-l-ok",
} as const;
const verdictWord = {
  idle: "text-ink-2",
  blocked: "text-accent-fg",
  error: "text-bad",
  done: "text-ok",
} as const;

/** `.ls-pill`: a tinted capsule — the state colour at 13 % behind a dot and the label. */
function StateCapsule({ state, label }: { state: StateTone; label: string }) {
  const color =
    state === "blocked"
      ? "var(--color-accent-fg)"
      : state === "idle"
        ? "var(--color-ink-2)"
        : stateToneVar[state];
  const tint = state === "idle" ? "var(--color-ink)" : stateToneVar[state];
  return (
    <span
      className="inline-flex h-[22px] items-center gap-[6px] rounded-full py-0 pr-[9px] pl-2 text-[11.5px] font-medium whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in srgb, ${tint} ${state === "idle" ? 6 : 13}%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className={`size-[6px] rounded-full ${state === "working" ? "animate-pulse motion-reduce:animate-none" : ""}`}
        style={{ background: stateToneVar[state] }}
      />
      {label}
    </span>
  );
}

function Party({ party, testId }: { party: GoalLoopCardParty; testId: string }) {
  return (
    <span className="flex min-w-0 items-center gap-[7px]" data-testid={testId}>
      <Avatar name={party.name} size="md" />
      <span className="min-w-0 text-[12.5px] text-ink">
        <small className="block text-[10px] leading-[1.2] tracking-[0.06em] text-ink-3 uppercase">
          {party.role}
        </small>
        <span className="block truncate">{party.name}</span>
      </span>
    </span>
  );
}

/**
 * `Seznamy.dc.html` → Cíle card: segmented iteration ring on the left, then status
 * pill + budget percentage, title, maker ⇄ verifier pair, the last verdict box and
 * an action row. Presentational only; the app supplies the action buttons.
 */
export function GoalLoopCard({
  state,
  stateLabel,
  title,
  used,
  max,
  ringCaption,
  ringAriaLabel,
  budgetLabel,
  maker,
  verifier,
  verdict,
  verdictTone = "idle",
  actions,
  onOpen,
  openLabel,
  ref,
  ...rest
}: GoalLoopCardProps) {
  return (
    <div
      className="relative grid min-w-0 grid-cols-[86px_minmax(0,1fr)] gap-[18px] rounded-[12px] border border-line bg-panel p-[18px] transition-colors hover:border-line-2 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-[20px]"
      data-testid={GoalLoopCardTestId.Root}
      ref={ref}
      {...rest}
    >
      {onOpen && (
        <button
          aria-label={openLabel ?? title}
          className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-accent"
          data-testid={GoalLoopCardTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      <SegmentedRing
        ariaLabel={ringAriaLabel}
        caption={ringCaption}
        max={max}
        tone={state}
        used={used}
      />
      <div className="flex min-w-0 flex-col gap-[10px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span data-testid={GoalLoopCardTestId.State}>
            <StateCapsule label={stateLabel} state={state} />
          </span>
          <span
            className="ml-auto font-mono text-[11.5px] text-ink-3"
            data-testid={GoalLoopCardTestId.Budget}
          >
            {budgetLabel}
          </span>
        </div>
        <h3
          className="m-0 text-[15px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink"
          data-testid={GoalLoopCardTestId.Title}
        >
          {title}
        </h3>
        <div className="flex items-center gap-[10px]">
          <Party party={maker} testId={GoalLoopCardTestId.Maker} />
          <span aria-hidden="true" className="text-[16px] text-ink-3">
            ⇄
          </span>
          <Party party={verifier} testId={GoalLoopCardTestId.Verifier} />
        </div>
        <div
          className={`rounded-[9px] border-l-2 bg-ink/[0.03] px-[11px] py-[9px] text-[12.5px] leading-[1.45] text-ink-2 ${verdictBorder[verdictTone]}`}
          data-testid={GoalLoopCardTestId.Verdict}
        >
          <span className="mb-[3px] flex items-center gap-2 text-[11px] text-ink-3">
            {verdict.head}
            {verdict.status && (
              <b className={`font-medium ${verdictWord[verdictTone]}`}>{verdict.status}</b>
            )}
          </span>
          {verdict.text}
        </div>
        {actions && (
          <div
            className="relative z-[2] mt-auto flex flex-wrap gap-[6px]"
            data-testid={GoalLoopCardTestId.Actions}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
