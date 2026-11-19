"use client";

import { Button, Dropdown, Stack, ToggleChip } from "@zibby/design-system";
import type { DepartmentId, MemoryTier } from "@zibby/contracts";
import { useTranslations } from "next-intl";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { type BrainFilter, isFiltering } from "../brainModel";
import type { BrainSourceInfo } from "../hooks/useBrainData";
import { SourceShape } from "./SourceShape";

export enum BrainFiltersTestId {
  Source = "brain-filter-source",
  Tier = "brain-filter-tier",
  Orphans = "brain-filter-orphans",
  Clear = "brain-filter-clear",
}

const TIERS: MemoryTier[] = ["memory", "knowledge", "daily"];
const ALL_DEPARTMENTS = "";

export interface BrainFiltersProps {
  filter: BrainFilter;
  onChange: (next: BrainFilter) => void;
  sources: readonly BrainSourceInfo[];
  sourceColor: (sourceId: string) => string;
  /** Departments that own at least one vault note (the only ones worth offering). */
  departments: readonly DepartmentId[];
}

/** Toggle `value` in a "null = all" set: first click isolates nothing — it hides that one value. */
function toggle<T>(
  current: ReadonlySet<T> | null,
  all: readonly T[],
  value: T,
): ReadonlySet<T> | null {
  const next = new Set(current ?? all);
  if (!next.delete(value)) next.add(value);
  return next.size === all.length ? null : next;
}

/**
 * The filters over fields the data has today: sources, vault tiers, department shelf and "only
 * orphans" (notes nobody links to). Pressed = shown; "Zrušit filtry" appears once anything is off.
 */
export function BrainFilters({
  filter,
  onChange,
  sources,
  sourceColor,
  departments,
}: BrainFiltersProps) {
  const t = useTranslations("knowledge.brain.filters");
  const tm = useTranslations("memory");
  const lookup = useDepartmentLookup();
  const sourceIds = sources.map((s) => s.id);

  return (
    <Stack wrap align="center" direction="row" gap="75">
      {sources.map((s) => (
        <ToggleChip
          data-testid={`${BrainFiltersTestId.Source}-${s.id}`}
          key={s.id}
          leading={
            <SourceShape color={sourceColor(s.id)} shape={s.kind === "vault" ? "vault" : "kb"} />
          }
          onClick={() => onChange({ ...filter, sources: toggle(filter.sources, sourceIds, s.id) })}
          pressed={filter.sources === null || filter.sources.has(s.id)}
        >
          {s.name}
        </ToggleChip>
      ))}
      {TIERS.map((tier) => (
        <ToggleChip
          data-testid={`${BrainFiltersTestId.Tier}-${tier}`}
          key={tier}
          onClick={() => onChange({ ...filter, tiers: toggle(filter.tiers, TIERS, tier) })}
          pressed={filter.tiers === null || filter.tiers.has(tier)}
        >
          {tm(`tier.${tier}`)}
        </ToggleChip>
      ))}
      {departments.length > 0 && (
        <Dropdown<string>
          aria-label={t("department")}
          onChange={(v) =>
            onChange({ ...filter, department: v === ALL_DEPARTMENTS ? null : (v as DepartmentId) })
          }
          options={[
            { value: ALL_DEPARTMENTS, label: t("allDepartments") },
            ...departments.map((d) => ({ value: d, label: lookup.name(d) })),
          ]}
          value={filter.department ?? ALL_DEPARTMENTS}
          variant="inline"
        />
      )}
      <ToggleChip
        data-testid={BrainFiltersTestId.Orphans}
        onClick={() => onChange({ ...filter, orphansOnly: !filter.orphansOnly })}
        pressed={filter.orphansOnly}
      >
        {t("orphans")}
      </ToggleChip>
      {isFiltering(filter) && (
        <Button
          data-testid={BrainFiltersTestId.Clear}
          intent="ghost"
          onClick={() =>
            onChange({ sources: null, tiers: null, department: null, orphansOnly: false })
          }
          size="sm"
        >
          {t("clear")}
        </Button>
      )}
    </Stack>
  );
}
