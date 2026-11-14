import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { focusRing } from "../../utils/focus";
import { Icon, type IconName } from "../Icon/Icon";

export enum ActionPillTestId {
  Root = "action-pill-root",
  Lead = "action-pill-lead",
  Open = "action-pill-open",
  Sub = "action-pill-sub",
  Add = "action-pill-add",
}

export interface ActionPillProps {
  label: ReactNode;
  /** Small text after the label (target, "Queued"). */
  sub?: ReactNode;
  /** Glyph in the round lead button. Default `play`. */
  leadIcon?: IconName;
  /** Accessible name of the lead button (required: it is icon-only). */
  leadLabel: string;
  onLead: () => void;
  leadDisabled?: boolean;
  /** Overrides the lead button's test id. */
  leadTestId?: string;
  /** Opens the detail; omit to render the label as plain text. */
  onOpen?: () => void;
  /** Unique row key (`data-rk`). */
  rowKey?: string;
  selected?: boolean;
}

/** Chip-palette pill: a round lead button (run) beside the label (opens the detail). */
export function ActionPill({
  label,
  sub,
  leadIcon = "play",
  leadLabel,
  onLead,
  leadDisabled = false,
  leadTestId = ActionPillTestId.Lead,
  onOpen,
  rowKey,
  selected = false,
}: ActionPillProps) {
  const text = (
    <>
      <span className="font-medium text-ink">{label}</span>
      {sub ? (
        <span
          className="ml-[8px] text-[11px] font-normal text-ink-3"
          data-testid={ActionPillTestId.Sub}
        >
          {sub}
        </span>
      ) : null}
    </>
  );
  return (
    <span
      className={cn(
        "inline-flex h-[34px] max-w-full items-center gap-[8px] rounded-full border border-line-2 bg-panel pl-[7px] pr-[14px] text-body hover:border-ink-3 hover:bg-panel-2",
        selected && "ring-2 ring-accent",
      )}
      data-rk={rowKey}
      data-testid={ActionPillTestId.Root}
    >
      <button
        aria-label={leadLabel}
        className={cn(
          "grid size-[22px] flex-none cursor-pointer appearance-none place-items-center rounded-full bg-panel-2 text-ink disabled:cursor-default disabled:opacity-50",
          focusRing,
        )}
        data-testid={leadTestId}
        disabled={leadDisabled}
        onClick={onLead}
        type="button"
      >
        <Icon name={leadIcon} size="xs" />
      </button>
      {onOpen ? (
        <button
          aria-pressed={selected}
          className={cn("min-w-0 cursor-pointer appearance-none truncate text-left", focusRing)}
          data-testid={ActionPillTestId.Open}
          onClick={onOpen}
          type="button"
        >
          {text}
        </button>
      ) : (
        <span className="min-w-0 truncate">{text}</span>
      )}
    </span>
  );
}

export interface ActionPillAddProps {
  children: ReactNode;
  onClick: () => void;
  /** Overrides the default test id. */
  "data-testid"?: string;
}

/** The dashed "add" pill that ends the palette. */
export function ActionPillAdd({ children, onClick, "data-testid": testId }: ActionPillAddProps) {
  return (
    <button
      className={cn(
        "inline-flex h-[34px] cursor-pointer appearance-none items-center gap-[6px] rounded-full border border-dashed border-line-2 bg-transparent px-[12px] text-body text-ink-3 hover:border-ink-3 hover:text-ink",
        focusRing,
      )}
      data-testid={testId ?? ActionPillTestId.Add}
      onClick={onClick}
      type="button"
    >
      <Icon name="plus" size="xs" />
      {children}
    </button>
  );
}

export interface ActionPaletteProps {
  children?: ReactNode;
}

/** Wrapping row of pills. */
export function ActionPalette({ children }: ActionPaletteProps) {
  return <div className="flex flex-wrap gap-[8px]">{children}</div>;
}
