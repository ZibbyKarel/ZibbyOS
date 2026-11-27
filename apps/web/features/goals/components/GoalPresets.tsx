"use client";

import { useLocale, useTranslations } from "next-intl";
import { GOAL_PRESETS, type GoalPreset } from "@zibby/contracts";
import {
  Button,
  Container,
  DenseRow,
  DenseRowList,
  ListSection,
  Stack,
  Typography,
} from "@zibby/design-system";
import { type GoalLabel, goalScheduleLabel, goalScopeLabel, groupPresets } from "../goalView";

// Presets only use the project-less scopes, so names are never looked up.
const NO_NAMES = { projectName: (id: string) => id, companyName: (id: string) => id };

export enum GoalPresetsTestId {
  Root = "goal-presets",
  Add = "goal-preset-add",
  Added = "goal-preset-added",
}

export interface GoalPresetsProps {
  /** Ids of goals that already exist — a preset with the same id reads "Přidáno". */
  existingIds: ReadonlySet<string>;
  /** The preset id currently being created, to show its spinner. */
  pendingId?: string | null;
  onAdd: (preset: GoalPreset) => void;
}

/** The "Připravené cíle" section: the shipped presets by group, each added paused with one click. */
export function GoalPresets({ existingIds, pendingId, onAdd }: GoalPresetsProps) {
  const t = useTranslations("goals.presets");
  const tg = useTranslations("goals");
  const locale = useLocale();
  const label = (l: GoalLabel) => tg(l.key, l.values);
  return (
    <Container data-testid={GoalPresetsTestId.Root}>
      <ListSection count={GOAL_PRESETS.length} icon="sparkles" title={t("title")}>
        <Stack gap="250">
          <Typography size="caption" type="note" variant="secondary">
            {t("hint")}
          </Typography>
          {groupPresets(GOAL_PRESETS).map(({ group, presets }) => (
            <ListSection count={presets.length} key={group} title={t(`group.${group}`)}>
              <DenseRowList>
                {presets.map((preset) => {
                  const added = existingIds.has(preset.id);
                  return (
                    <DenseRow
                      cells={[
                        label(goalScopeLabel(preset.scope, NO_NAMES)),
                        label(goalScheduleLabel(preset, locale)),
                      ]}
                      hint={preset.predicate}
                      key={preset.id}
                      title={preset.name}
                      trailing={
                        added ? (
                          <Typography
                            data-testid={`${GoalPresetsTestId.Added}-${preset.id}`}
                            size="caption"
                            tone="accent"
                            type="note"
                          >
                            {t("added")}
                          </Typography>
                        ) : (
                          <Button
                            data-testid={`${GoalPresetsTestId.Add}-${preset.id}`}
                            icon="plus"
                            intent="secondary"
                            loading={pendingId === preset.id}
                            onClick={() => onAdd(preset)}
                            size="sm"
                          >
                            {t("add")}
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </DenseRowList>
            </ListSection>
          ))}
        </Stack>
      </ListSection>
    </Container>
  );
}
