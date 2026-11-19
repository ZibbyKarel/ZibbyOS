import type { ReactNode, Ref } from "react";
import { cn } from "../../utils/cn";
import { Icon, type IconName } from "../Icon/Icon";

export enum SettingsNoteTestId {
  Root = "settings-note-root",
  Actions = "settings-note-actions",
}

export type SettingsNoteTone = "info" | "wait" | "err" | "sky";

export interface SettingsNoteProps {
  tone?: SettingsNoteTone;
  /** Leading glyph; defaults per tone. */
  icon?: IconName;
  /** Right-aligned buttons / links. */
  actions?: ReactNode;
  /** Drop the panel gutter (use outside a panel). */
  flush?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

const toneClass: Record<SettingsNoteTone, string> = {
  info: "border-line bg-ink/3 [&>.i]:text-ink-3",
  wait: "border-warn/30 bg-warn/7 [&>.i]:text-warn",
  err: "border-bad/32 bg-bad/7 [&>.i]:text-bad",
  sky: "border-state-think/30 bg-state-think/7 [&>.i]:text-state-think",
};
const defaultIcon: Record<SettingsNoteTone, IconName> = {
  info: "lock",
  wait: "warn",
  err: "warn",
  sky: "upgrade",
};

/** Inline callout inside a settings panel (Bridge `.st-note`): glyph, copy with a bold lead, optional actions. */
export function SettingsNote({
  tone = "info",
  icon,
  actions,
  flush = false,
  children,
  ref,
}: SettingsNoteProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-[10px] rounded-[9px] border px-[12px] py-[10px] text-[12.5px] leading-[1.5] text-ink-2 [&_b]:font-medium [&_b]:text-ink",
        flush ? "" : "mx-4 mb-[14px]",
        toneClass[tone],
      )}
      data-testid={SettingsNoteTestId.Root}
      data-tone={tone}
      ref={ref}
      role={tone === "err" ? "alert" : "status"}
    >
      <span aria-hidden="true" className="i mt-px inline-flex">
        <Icon name={icon ?? defaultIcon[tone]} size="sm" />
      </span>
      <div className="min-w-0">{children}</div>
      {actions && (
        <div
          className="flex flex-wrap items-center justify-end gap-[6px] self-center"
          data-testid={SettingsNoteTestId.Actions}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
