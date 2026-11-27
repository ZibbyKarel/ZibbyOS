import type { HTMLAttributes, ReactNode, Ref } from "react";
import { type StateTone, stateToneVar } from "../../stateTone";
import { Avatar } from "../Avatar/Avatar";
import { SegmentedRing } from "../SegmentedRing/SegmentedRing";

export enum GoalLoopCardTestId {
  Root = "goal-loop-card-root",
  Open = "goal-loop-card-open",
  State = "goal-loop-card-state",
  TopMeta = "goal-loop-card-top-meta",
  Title = "goal-loop-card-title",
  Parties = "goal-loop-card-parties",
  /** Suffixed with the party's index: `goal-loop-card-party-0`. */
  Party = "goal-loop-card-party",
  PartySeparator = "goal-loop-card-party-separator",
  Verdict = "goal-loop-card-verdict",
  Actions = "goal-loop-card-actions",
}

export interface GoalLoopCardParty {
  name: string;
  /** Small uppercase role label above the name (`"Maker"`, `"Rozsah"`). */
  role: string;
  /** Initial avatar before the name; default `true`. Off for a party that is not a person. */
  avatar?: boolean;
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
  /** Ring caption, e.g. `"z 12 iterací"`. Not shown in `compact`. */
  ringCaption?: string;
  /** Big ring numeral; defaults to `used` (e.g. `"–"` before anything ran). */
  ringValue?: string;
  ringAriaLabel: string;
  /** Top-right mono text (`"58 % rozpočtu iterací"`, a schedule). Not shown in `compact`. */
  topMeta?: string;
  /** Pair row under the title. Omitted or empty: no row. Not shown in `compact`. */
  parties?: GoalLoopCardParty[];
  /** Between the parties (the design's `"⇄"`). Omitted: none. */
  partySeparator?: ReactNode;
  /**
   * Verdict box. `head` is the grey lead-in (`"Verdikt · iterace 7"`), `status` the coloured word.
   * Omitted: no box. `compact` shows only `text`, on one line.
   */
  verdict?: { head: string; status?: string; text: string };
  /** Colour of the verdict box's left border and status word. */
  verdictTone?: "idle" | "blocked" | "error" | "done";
  /** Action row (buttons). Sits above the card's open target. Not shown in `compact`. */
  actions?: ReactNode;
  /** Design `.ls-c.sel`: ink border + inset ring. */
  selected?: boolean;
  /** `compact`: a narrow widget tile — 56px ring, pill + title + one verdict line. */
  size?: "full" | "compact";
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
      {party.avatar !== false && <Avatar name={party.name} size="md" />}
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
 * `Seznamy.dc.html` → Cíle card: segmented ring on the left, then status pill + top-right
 * mono meta, title, a row of parties, the last verdict box and an action row. `compact`
 * is the same card for a narrow widget. Presentational only; the app supplies the actions.
 */
export function GoalLoopCard({
  state,
  stateLabel,
  title,
  used,
  max,
  ringCaption,
  ringValue,
  ringAriaLabel,
  topMeta,
  parties,
  partySeparator,
  verdict,
  verdictTone = "idle",
  actions,
  selected = false,
  size = "full",
  onOpen,
  openLabel,
  ref,
  ...rest
}: GoalLoopCardProps) {
  const compact = size === "compact";
  const frame = selected
    ? "border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]"
    : "border-line hover:border-line-2 hover:shadow-[var(--shadow-elevated)]";
  const layout = compact
    ? "grid-cols-[56px_minmax(0,1fr)] items-center gap-[12px] p-[12px]"
    : "grid-cols-[86px_minmax(0,1fr)] gap-[18px] p-[18px] sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-[20px]";
  return (
    <div
      className={`relative grid min-w-0 rounded-[12px] border bg-panel transition-[border-color,box-shadow] ${layout} ${frame}`}
      data-selected={selected}
      data-size={size}
      data-testid={GoalLoopCardTestId.Root}
      ref={ref}
      {...rest}
    >
      {onOpen && (
        <button
          aria-current={selected ? "true" : undefined}
          aria-label={openLabel ?? title}
          className="absolute inset-0 z-[1] cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          data-testid={GoalLoopCardTestId.Open}
          onClick={onOpen}
          type="button"
        />
      )}
      <SegmentedRing
        ariaLabel={ringAriaLabel}
        caption={compact ? undefined : ringCaption}
        max={max}
        size={compact ? 56 : undefined}
        tone={state}
        used={used}
        value={ringValue}
      />
      <div className={`flex min-w-0 flex-col ${compact ? "gap-[4px]" : "gap-[10px]"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span data-testid={GoalLoopCardTestId.State}>
            <StateCapsule label={stateLabel} state={state} />
          </span>
          {!compact && topMeta && (
            <span
              className="ml-auto font-mono text-[11.5px] text-ink-3"
              data-testid={GoalLoopCardTestId.TopMeta}
            >
              {topMeta}
            </span>
          )}
        </div>
        <h3
          className={`m-0 leading-[1.3] font-semibold tracking-[-0.015em] text-ink ${compact ? "truncate text-[13.5px]" : "text-[15px]"}`}
          data-testid={GoalLoopCardTestId.Title}
        >
          {title}
        </h3>
        {!compact && parties && parties.length > 0 && (
          <div className="flex items-center gap-[10px]" data-testid={GoalLoopCardTestId.Parties}>
            {parties.map((party, i) => (
              <span className="contents" key={`${party.role}-${i}`}>
                {i > 0 && partySeparator != null && (
                  <span
                    aria-hidden="true"
                    className="text-[16px] text-ink-3"
                    data-testid={GoalLoopCardTestId.PartySeparator}
                  >
                    {partySeparator}
                  </span>
                )}
                <Party party={party} testId={`${GoalLoopCardTestId.Party}-${i}`} />
              </span>
            ))}
          </div>
        )}
        {verdict &&
          (compact ? (
            <span
              className="truncate text-[12px] leading-[1.45] text-ink-2"
              data-testid={GoalLoopCardTestId.Verdict}
            >
              {verdict.text}
            </span>
          ) : (
            <div
              className={`rounded-[9px] border-l-2 bg-ink/[0.03] px-[11px] py-[9px] text-[12.5px] leading-[1.45] text-pretty text-ink-2 ${verdictBorder[verdictTone]}`}
              data-testid={GoalLoopCardTestId.Verdict}
            >
              <span className="mb-[3px] flex items-center gap-2 text-[11px] text-ink-3">
                {verdict.head}
                {verdict.status && (
                  <b className={`font-medium ${verdictWord[verdictTone]}`}>{verdict.status}</b>
                )}
              </span>
              <span className="line-clamp-3">{verdict.text}</span>
            </div>
          ))}
        {!compact && actions && (
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
