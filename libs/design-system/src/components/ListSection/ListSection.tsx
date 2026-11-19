import type { ReactNode, Ref } from "react";
import { Icon } from "../Icon/Icon";
import type { IconName } from "../Icon/Icon";

export enum ListSectionTestId {
  Root = "list-section-root",
  Head = "list-section-head",
  Title = "list-section-title",
  Count = "list-section-count",
  Hint = "list-section-hint",
}

export interface ListSectionProps {
  title: string;
  count?: number | string;
  /** Leading icon tile; ignored when `code` is given. */
  icon?: IconName;
  /** Mono department code tile ("ENG") instead of an icon. */
  code?: string;
  /** Mono text after the count (e.g. "cron"). */
  hint?: string;
  /** Right end of the rule (a button, e.g. "Delete category"). */
  trailing?: ReactNode;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** A group of cards under a header line: tile, bold title, faint count, hairline rule (design `.ls-sec`). */
export function ListSection({
  title,
  count,
  icon,
  code,
  hint,
  trailing,
  children,
  ref,
}: ListSectionProps) {
  return (
    <section className="flex flex-col gap-[14px]" data-testid={ListSectionTestId.Root} ref={ref}>
      <div className="flex items-center gap-[10px]" data-testid={ListSectionTestId.Head}>
        {code ? (
          <span className="rounded-[6px] border border-line-2 px-[6px] py-[2px] font-mono text-[10px] text-ink-2">
            {code}
          </span>
        ) : icon ? (
          <span className="grid size-[26px] place-items-center rounded-[7px] border border-line bg-panel text-ink-2">
            <Icon name={icon} size="sm" />
          </span>
        ) : null}
        <span className="text-[13px] font-semibold text-ink" data-testid={ListSectionTestId.Title}>
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[12px] text-ink-3" data-testid={ListSectionTestId.Count}>
            {count}
          </span>
        )}
        {hint && (
          <span className="font-mono text-[11px] text-ink-3" data-testid={ListSectionTestId.Hint}>
            {hint}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-line" />
        {trailing}
      </div>
      {children}
    </section>
  );
}
