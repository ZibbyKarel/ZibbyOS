import type { ReactNode, Ref } from "react";
import type { IconName } from "../../assets/icons";
import { focusRing } from "../../utils/focus";
import { Icon } from "../Icon/Icon";

export enum ZibbySuggestionsTestId {
  Root = "zibby-suggestions-root",
  Lead = "zibby-suggestions-lead",
  Item = "zibby-suggestions-item",
}

export interface ZibbySuggestionItem {
  label: string;
  onSelect: () => void;
  /** Optional leading glyph (12 px). */
  icon?: IconName;
  /** Optional muted text rendered before this pill (e.g. "nebo přilož:"). */
  lead?: ReactNode;
}

export interface ZibbySuggestionsProps {
  /** Muted label before the first pill (e.g. "Zkus říct:"). */
  lead?: ReactNode;
  items: ZibbySuggestionItem[];
  /** Accessible name of the group. Default `"Suggestions"`. */
  label?: string;
  "data-testid"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Row of dashed suggestion pills (`.ztry`) — wraps and centres. */
export function ZibbySuggestions({
  lead,
  items,
  label = "Suggestions",
  "data-testid": testId = ZibbySuggestionsTestId.Root,
  ref,
}: ZibbySuggestionsProps) {
  return (
    <div
      aria-label={label}
      className="flex flex-wrap items-center justify-center gap-2 text-[12px] text-ink-3"
      data-testid={testId}
      ref={ref}
      role="group"
    >
      {lead ? <span data-testid={ZibbySuggestionsTestId.Lead}>{lead}</span> : null}
      {items.map((item, i) => (
        <span className="contents" key={`${item.label}-${i}`}>
          {item.lead ? <span data-testid={ZibbySuggestionsTestId.Lead}>{item.lead}</span> : null}
          <button
            className={`inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-2 px-3 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink ${focusRing}`}
            data-testid={ZibbySuggestionsTestId.Item}
            onClick={item.onSelect}
            type="button"
          >
            {item.icon ? <Icon name={item.icon} size="xs" /> : null}
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
