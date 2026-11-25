import { type Ref, useEffect, useRef } from "react";
import type { StateTone } from "../../stateTone";
import { stateToneVar } from "../../stateTone";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Typography } from "../Typography/Typography";

export interface LogStreamLine {
  id: string;
  /** Pre-formatted timestamp, e.g. `14:02:07`. */
  ts: string;
  state?: StateTone;
  source?: string;
  text: string;
  /** Render the line with the Alert "error" look (tinted surface, bad-tone text). */
  alert?: boolean;
}

export enum LogStreamTestId {
  Root = "log-stream-root",
  Header = "log-stream-header",
  Body = "log-stream-body",
  /** Each line is suffixed with its `id`. */
  Line = "log-stream-line",
  Caret = "log-stream-caret",
  Empty = "log-stream-empty",
}

export interface LogStreamProps {
  lines: LogStreamLine[];
  /** While true, the caret stops blinking (still drawn solid on the newest line). */
  paused?: boolean;
  /** Only the last `max` lines are rendered; the rest are dropped from the DOM.
   * Note: this is a plain slice, not a scroll-virtualised window — fine for the
   * hundreds-of-lines range DS.md §8 calls for; a >500-line true virtualised
   * list is deferred (no virtualisation dep in the workspace yet). */
  max?: number;
  empty?: string;
  /** When set, every `alert` line is a keyboard-reachable button (accessible name = its text). */
  onLineClick?: (id: string) => void;
  /** The line with this id is scrolled into view (once per change) and outlined. */
  focusId?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * DS.md §8 activity log — a mono `TIME · SOURCE · EVENT` stream, newest line
 * lit `--ink` with a blinking block caret (`zb-caret`), everything above it
 * dimmed to secondary/tertiary. Used standalone (Activity screens) and folded
 * into a task/run detail panel.
 */
export function LogStream({
  lines,
  paused,
  max,
  empty,
  onLineClick,
  focusId,
  ref,
}: LogStreamProps) {
  const visible = max ? lines.slice(-max) : lines;
  const newestId = visible.at(-1)?.id;
  return (
    <div
      className="border border-border bg-surface-panel"
      data-testid={LogStreamTestId.Root}
      ref={ref}
    >
      <div
        className="grid grid-cols-[78px_110px_minmax(0,1fr)] gap-3 border-b border-border px-4 py-[9px]"
        data-testid={LogStreamTestId.Header}
      >
        <Typography tracking="wider" type="labelSm" variant="tertiary">
          Time
        </Typography>
        <Typography tracking="wider" type="labelSm" variant="tertiary">
          Source
        </Typography>
        <Typography tracking="wider" type="labelSm" variant="tertiary">
          Event
        </Typography>
      </div>
      <div className="bg-background py-1.5" data-testid={LogStreamTestId.Body}>
        {visible.length === 0 ? (
          <div className="px-4 py-3.5" data-testid={LogStreamTestId.Empty}>
            <Typography type="bodySm" variant="secondary">
              {empty ?? "Nothing matches yet. New events appear as they stream in."}
            </Typography>
          </div>
        ) : (
          visible.map((line) => (
            <LogLine
              focused={line.id === focusId}
              key={line.id}
              line={line}
              live={line.id === newestId}
              onClick={onLineClick}
              paused={paused}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LogLine({
  line,
  live,
  paused,
  focused,
  onClick,
}: {
  line: LogStreamLine;
  live: boolean;
  paused?: boolean;
  focused: boolean;
  onClick?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: "center" });
  }, [focused]);

  const state = line.state ?? (line.alert ? "error" : undefined);
  // Only alert lines are actionable — a no-op button on every line would be noise for a11y.
  const click = line.alert ? onClick : undefined;
  const Row = click ? "button" : "div";
  return (
    <Row
      className={cn(
        "grid w-full grid-cols-[78px_110px_minmax(0,1fr)] items-center gap-3 px-4 py-1 text-left",
        line.alert && "border border-bad/25 bg-bad-solid",
        click && cn("cursor-pointer", focusRingInset),
        focused && "outline outline-2 -outline-offset-2 outline-accent",
      )}
      data-testid={`${LogStreamTestId.Line}-${line.id}`}
      onClick={click ? () => click(line.id) : undefined}
      ref={ref}
      type={click ? "button" : undefined}
    >
      <Typography type="code" variant="tertiary">
        {line.ts}
      </Typography>
      <Typography type="code" variant="secondary">
        {line.source}
      </Typography>
      <Typography
        truncate
        as="span"
        style={{ color: state ? stateToneVar[state] : undefined }}
        type="code"
        variant={live ? "primary" : "secondary"}
      >
        {line.text}
        {live && (
          <span
            aria-hidden="true"
            className="ml-[2px] inline-block h-[12px] w-[6px] align-[-2px]"
            data-testid={LogStreamTestId.Caret}
            style={{
              animation: paused ? "none" : "zb-caret 1s steps(1,end) infinite",
              background: "var(--color-ink)",
            }}
          />
        )}
      </Typography>
    </Row>
  );
}
