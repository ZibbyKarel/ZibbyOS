"use client";
import { type ReactNode, type Ref, useId } from "react";
import { cn } from "../../utils/cn";
import { focusRingInset } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum SettingsPanelTestId {
  Root = "settings-panel-root",
  Header = "settings-panel-header",
  Title = "settings-panel-title",
  Toggle = "settings-panel-toggle",
  Actions = "settings-panel-actions",
  Body = "settings-panel-body",
}

export type SettingsPanelTone = "default" | "dirty" | "error" | "attention" | "dashed";

export interface SettingsPanelProps {
  /** Anchor id — the "On this page" rail links to `#id`. */
  id?: string;
  title: ReactNode;
  /** A {@link StatusBadge} (or a few) right after the title. */
  badge?: ReactNode;
  description?: ReactNode;
  /** Right-aligned header actions: Discard / Save, Send test, … */
  actions?: ReactNode;
  /** Border emphasis: dirty = unsaved edits (ink), error = failed save, attention = deep-linked, dashed = not set up. */
  tone?: SettingsPanelTone;
  /** Collapsible panel: the whole header is a disclosure button with a chevron. */
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

const toneClass: Record<SettingsPanelTone, string> = {
  default: "border-line bg-panel",
  dirty: "border-ink/30 bg-panel",
  error: "border-bad/50 bg-panel",
  attention:
    "border-warn/55 bg-panel shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-warn)_14%,transparent)]",
  dashed: "border-dashed border-line-2 bg-transparent",
};

/**
 * One titled settings panel (Bridge `.st-pnl`): header with title, badge, description and
 * actions over a stack of {@link SettingsRow}s. `tone="dirty"` is the draft grammar's panel
 * border; `collapsible` turns the header into a disclosure (the live log).
 */
export function SettingsPanel({
  id,
  title,
  badge,
  description,
  actions,
  tone = "default",
  collapsible = false,
  open = true,
  onOpenChange,
  children,
  ref,
}: SettingsPanelProps) {
  const uid = useId();
  const titleId = `${uid}-t`;
  const bodyId = `${uid}-b`;
  const head = (
    <>
      <div className="min-w-0 flex-1">
        <h2
          className="flex flex-wrap items-center gap-2 text-[14px] leading-[1.35] font-semibold tracking-[-0.01em] text-ink"
          data-testid={SettingsPanelTestId.Title}
          id={titleId}
        >
          {title}
          {badge}
        </h2>
        {description && (
          <p className="mt-[3px] max-w-[62ch] text-[12.5px] text-pretty text-ink-3">
            {description}
          </p>
        )}
      </div>
    </>
  );
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-5 rounded-[12px] border transition-[border-color,box-shadow]",
        toneClass[tone],
      )}
      data-testid={SettingsPanelTestId.Root}
      data-tone={tone}
      id={id}
      ref={ref}
    >
      <div className="flex items-start gap-3" data-testid={SettingsPanelTestId.Header}>
        {collapsible ? (
          <button
            aria-controls={bodyId}
            aria-expanded={open}
            className={cn(
              "flex w-full items-start gap-3 rounded-[12px] px-4 pt-[14px] pb-3 text-left hover:bg-ink/2",
              focusRingInset,
            )}
            data-testid={SettingsPanelTestId.Toggle}
            onClick={() => onOpenChange?.(!open)}
            type="button"
          >
            {head}
            <span
              aria-hidden="true"
              className={cn("mt-px text-ink-3 transition-transform", open && "rotate-180")}
            >
              <Icon name="chevron" size="sm" />
            </span>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3 px-4 pt-[14px] pb-3">{head}</div>
        )}
        {actions && (
          <div
            className="flex flex-none flex-wrap items-center justify-end gap-[6px] pt-[14px] pr-4 pb-3"
            data-testid={SettingsPanelTestId.Actions}
          >
            {actions}
          </div>
        )}
      </div>
      {(!collapsible || open) && (
        <div data-testid={SettingsPanelTestId.Body} id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
