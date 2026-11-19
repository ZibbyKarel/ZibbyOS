import type { ReactNode } from "react";
import { Icon } from "../Icon/Icon";

export enum EngineBadgeTestId {
  Root = "engine-badge-root",
  Badge = "engine-badge-badge",
  Mark = "engine-badge-mark",
}

/** Which AI engine mark to show: Claude Code, OpenAI, OpenCode, or the BlueCode gateway. */
export type EngineBadgeEngine = "claude" | "openai" | "opencode" | "bluecode";

export interface EngineBadgeProps {
  /** The mark to show in the bottom-right corner; absent renders the children untouched. */
  engine?: EngineBadgeEngine;
  /** Several marks, shown as an overlapping stack (takes precedence over `engine`). */
  engines?: EngineBadgeEngine[];
  /** Accessible name / tooltip of the mark(s) ("Claude Code", "OpenAI", "OpenCode"). */
  label?: string;
  /** The avatar / glyph the badge sits on. */
  children: ReactNode;
}

const defaultLabel: Record<EngineBadgeEngine, string> = {
  claude: "Claude Code",
  openai: "OpenAI",
  opencode: "OpenCode",
  bluecode: "BlueCode",
};

const isEngine = (engine: string): engine is EngineBadgeEngine => engine in defaultLabel;

/**
 * The bare glyph of an engine: its brand icon, or the given text (initials) for an engine
 * without one. Shared by the badge and every card that pins an engine to an avatar.
 */
export function EngineGlyph({ engine }: { engine: string }) {
  return isEngine(engine) ? <Icon name={engine} size="xs" /> : <>{engine}</>;
}

/** Wraps an avatar and pins a small engine icon (or an overlapping stack of them) to its bottom-right corner. */
export function EngineBadge({ engine, engines, label, children }: EngineBadgeProps) {
  const marks = engines?.length ? engines : engine ? [engine] : [];
  if (!marks.length) return <>{children}</>;
  const name = label ?? marks.map((m) => defaultLabel[m]).join(", ");
  return (
    <span className="relative inline-flex shrink-0" data-testid={EngineBadgeTestId.Root}>
      {children}
      <span
        aria-label={name}
        className="absolute -right-1 -bottom-1 inline-flex"
        data-engine={marks.join(" ")}
        data-testid={EngineBadgeTestId.Badge}
        role="img"
        title={name}
      >
        {marks.map((m, i) => (
          <span
            aria-hidden="true"
            className={`grid size-4 place-items-center rounded-full border border-line bg-panel text-ink-2${i ? " -ml-1.5" : ""}`}
            data-testid={EngineBadgeTestId.Mark}
            key={m}
          >
            <EngineGlyph engine={m} />
          </span>
        ))}
      </span>
    </span>
  );
}
