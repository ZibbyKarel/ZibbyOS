"use client";

import { Button, Dropdown, Stack, ToggleChip } from "@zibby/design-system";
import type { DepartmentId, MemoryTier } from "@zibby/contracts";
import { useTranslations } from "next-intl";
import { useDepartmentLookup } from "../../departments/useDepartmentLookup";
import { type BrainFilter, NO_FILTER, isFiltering } from "../brainModel";
import type { BrainSourceInfo } from "../hooks/useBrainData";
import { SourceShape } from "./SourceShape";

export enum BrainFiltersTestId {
  Source = "brain-filter-source",
  Tier = "brain-filter-tier",
  Orphans = "brain-filter-orphans",
  Clear = "brain-filter-clear",
  Unsorted = "brain-filter-unsorted",
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
  /** Unsorted notes: vault notes flagged raw plus team KB notes under `inbox/`. */
  unsortedCount: number;
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
 * The compact filter row that floats over the graph: source chips ("Name · count"), vault tier
 * chips, the department dropdown and "Jen sirotci" (notes nobody links to). Pressed = shown;
 * "Zrušit filtry" appears once anything is off. No tag dropdown: the graph carries no tags today.
 */
export function BrainFilters({
  filter,
  onChange,
  sources,
  sourceColor,
  departments,
  unsortedCount,
}: BrainFiltersProps) {
  const t = useTranslations("knowledge.brain.filters");
  const tm = useTranslations("memory");
  const lookup = useDepartmentLookup();
  const sourceIds = sources.map((s) => s.id);

  return (
    <Stack gap="50">
      <Stack wrap align="center" direction="row" gap="75">
        {sources.map((s) => (
          <ToggleChip
            data-testid={`${BrainFiltersTestId.Source}-${s.id}`}
            key={s.id}
            leading={
              <SourceShape color={sourceColor(s.id)} shape={s.kind === "vault" ? "vault" : "kb"} />
            }
            onClick={() =>
              onChange({ ...filter, sources: toggle(filter.sources, sourceIds, s.id) })
            }
            pressed={filter.sources === null || filter.sources.has(s.id)}
            tone="quiet"
          >
            {s.name} · {s.notes}
          </ToggleChip>
        ))}
        {TIERS.map((tier) => (
          <ToggleChip
            data-testid={`${BrainFiltersTestId.Tier}-${tier}`}
            key={tier}
            onClick={() => onChange({ ...filter, tiers: toggle(filter.tiers, TIERS, tier) })}
            pressed={filter.tiers === null || filter.tiers.has(tier)}
            tone="quiet"
          >
            {tm(`tier.${tier}`)}
          </ToggleChip>
        ))}
        {departments.length > 0 && (
          <Dropdown<string>
            plain
            aria-label={t("department")}
            onChange={(v) =>
              onChange({
                ...filter,
                department: v === ALL_DEPARTMENTS ? null : (v as DepartmentId),
              })
            }
            options={[
              { value: ALL_DEPARTMENTS, label: t("department") },
              ...departments.map((d) => ({ value: d, label: lookup.name(d) })),
            ]}
            size="sm"
            value={filter.department ?? ALL_DEPARTMENTS}
            variant="inline"
          />
        )}
        <ToggleChip
          data-testid={BrainFiltersTestId.Orphans}
          onClick={() => onChange({ ...filter, orphansOnly: !filter.orphansOnly })}
          pressed={filter.orphansOnly}
          tone="plain"
        >
          {t("orphans")}
        </ToggleChip>
        {isFiltering(filter) && (
          <Button
            data-testid={BrainFiltersTestId.Clear}
            intent="ghost"
            onClick={() => onChange(NO_FILTER)}
            size="sm"
          >
            {t("clear")}
          </Button>
        )}
      </Stack>
      {unsortedCount > 0 && (
        <Stack align="center" direction="row">
          <ToggleChip
            data-testid={BrainFiltersTestId.Unsorted}
            leading={<SourceShape color="var(--color-ink-3)" shape="dashed" />}
            onClick={() => onChange({ ...filter, unsortedOnly: !filter.unsortedOnly })}
            pressed={filter.unsortedOnly}
            tone="plain"
          >
            {t("unsorted")} · {unsortedCount}
          </ToggleChip>
        </Stack>
      )}
    </Stack>
  );
}
