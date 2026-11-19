import type { ReactNode, Ref } from "react";
import { SearchInput } from "../SearchInput/SearchInput";
import { ToggleChip } from "../ToggleChip/ToggleChip";

export enum ListToolbarTestId {
  Root = "list-toolbar-root",
  Search = "list-toolbar-search",
  Chip = "list-toolbar-chip",
  Count = "list-toolbar-chip-count",
}

export interface ListToolbarChip {
  id: string;
  label: string;
  count?: number;
}

export interface ListToolbarProps {
  /** Search box; omit on lists that have none. */
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  chips?: ListToolbarChip[];
  activeChip?: string;
  onChipChange?: (id: string) => void;
  /** Extra controls after the chips (e.g. a view toggle). */
  trailing?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Shared list filter bar: a 280px search box plus pill count-chips (design `.ls-fbar`). */
export function ListToolbar({
  search,
  chips,
  activeChip,
  onChipChange,
  trailing,
  ref,
}: ListToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-[10px]"
      data-testid={ListToolbarTestId.Root}
      ref={ref}
    >
      {search && (
        <div className="w-[280px] max-w-full" data-testid={ListToolbarTestId.Search}>
          <SearchInput
            ariaLabel={search.placeholder}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            value={search.value}
          />
        </div>
      )}
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {chips.map((c) => (
            <span data-testid={ListToolbarTestId.Chip} key={c.id}>
              <ToggleChip onClick={() => onChipChange?.(c.id)} pressed={c.id === activeChip}>
                {c.label}
                {c.count !== undefined && (
                  <span
                    className="-ml-[2px] font-mono text-[11px] opacity-65"
                    data-testid={ListToolbarTestId.Count}
                  >
                    {c.count}
                  </span>
                )}
              </ToggleChip>
            </span>
          ))}
        </div>
      )}
      {trailing}
    </div>
  );
}
