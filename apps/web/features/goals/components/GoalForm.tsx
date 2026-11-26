"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, Grid, SelectField, Stack } from "@zibby/design-system";
import {
  Controller,
  FormSegmentPicker,
  FormSelect,
  FormTextArea,
  FormTextInput,
  useFormControls,
  useWatch,
} from "@zibby/forms";
import { useCompaniesQuery } from "../../companies/queries";
import { useProjectsQuery } from "../../projects/queries";
import { EMPTY_GOAL_FORM, type GoalFormValues, isGoalFormValid } from "../goalForm";

export enum GoalFormTestId {
  Name = "goal-form-name",
  Outcome = "goal-form-outcome",
  Predicate = "goal-form-predicate",
  Deadline = "goal-form-deadline",
  CadenceHour = "goal-form-cadence-hour",
  CycleHours = "goal-form-cycle-hours",
  MaxRuns = "goal-form-max-runs",
  MaxCost = "goal-form-max-cost",
  Submit = "goal-form-submit",
  Cancel = "goal-form-cancel",
  Error = "goal-form-error",
}

export interface GoalFormProps {
  /** Prefill (edit mode); omitted for a new goal. */
  initial?: GoalFormValues;
  submitLabel: string;
  pending?: boolean;
  /** A server-side failure to show above the actions (e.g. a duplicate id). */
  error?: string;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
}

/**
 * The one goal form: the create dialog mounts it empty, the detail page mounts it
 * prefilled in place of the read-only settings. Timing is either one-off or standing;
 * only the chosen side's fields render, so the two can never be sent together.
 */
export function GoalForm({
  initial = EMPTY_GOAL_FORM,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const t = useTranslations("goals.form");
  const tk = useTranslations();
  const projects = useProjectsQuery().data ?? [];
  const companies = useCompaniesQuery().data ?? [];

  const { renderForm, submit, form } = useFormControls<GoalFormValues>({
    defaultValues: initial,
    mode: "onChange",
    onSubmit: (values) => {
      if (!pending) onSubmit(values);
    },
  });
  const values = useWatch({ control: form.control }) as GoalFormValues;
  const canSubmit = isGoalFormValid({ ...initial, ...values }) && !pending;

  return renderForm(
    <Stack gap="200">
      <FormTextInput<GoalFormValues>
        autoFocus
        data-testid={GoalFormTestId.Name}
        label={t("name")}
        name="name"
        placeholder={t("namePlaceholder")}
      />
      <FormTextArea<GoalFormValues>
        data-testid={GoalFormTestId.Outcome}
        hint={t("outcomeHint")}
        label={t("outcome")}
        name="outcome"
        rows={5}
      />
      <FormTextInput<GoalFormValues>
        data-testid={GoalFormTestId.Predicate}
        hint={t("predicateHint")}
        label={t("predicate")}
        name="predicate"
      />

      <FormSegmentPicker<GoalFormValues>
        label={t("scope")}
        name="scopeKind"
        options={[
          { value: "none", label: t("scopeNone") },
          { value: "projects", label: t("scopeProjects") },
          { value: "company", label: t("scopeCompany") },
          { value: "all", label: t("scopeAll") },
        ]}
      />
      {values.scopeKind === "projects" && (
        <Controller
          control={form.control}
          name="projectIds"
          render={({ field }) => (
            <SelectField
              multi
              label={t("scopeProjectsPick")}
              onValueChange={field.onChange}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={t("scopeProjectsPlaceholder")}
              removeLabel={tk("common.delete")}
              value={field.value ?? []}
            />
          )}
        />
      )}
      {values.scopeKind === "company" && (
        <FormSelect<string, GoalFormValues>
          label={t("scopeCompanyPick")}
          name="companyId"
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          placeholder={t("scopeCompanyPlaceholder")}
        />
      )}

      <FormSegmentPicker<GoalFormValues>
        hint={t("timingHint")}
        label={t("timing")}
        name="timing"
        options={[
          { value: "oneoff", label: t("timingOneOff") },
          { value: "standing", label: t("timingStanding") },
        ]}
      />
      {values.timing === "oneoff" ? (
        <FormTextInput<GoalFormValues>
          data-testid={GoalFormTestId.Deadline}
          hint={t("deadlineHint")}
          label={t("deadline")}
          name="deadline"
          type="datetime-local"
        />
      ) : (
        <Grid align="start" cols={1} gap="150" md={3}>
          <FormSegmentPicker<GoalFormValues>
            compact
            label={t("cadenceEvery")}
            name="cadenceEvery"
            options={[
              { value: "day", label: t("everyDay") },
              { value: "weekday", label: t("everyWeekday") },
              { value: "week", label: t("everyWeek") },
              { value: "month", label: t("everyMonth") },
            ]}
          />
          <FormTextInput<GoalFormValues>
            data-testid={GoalFormTestId.CadenceHour}
            hint={t("cadenceHourHint")}
            label={t("cadenceHour")}
            max={23}
            min={0}
            name="cadenceHour"
            type="number"
          />
          <FormTextInput<GoalFormValues>
            data-testid={GoalFormTestId.CycleHours}
            hint={t("cycleHoursHint")}
            label={t("cycleHours")}
            min={1}
            name="cycleHours"
            type="number"
          />
        </Grid>
      )}

      <Grid align="start" cols={1} gap="150" md={2}>
        <FormTextInput<GoalFormValues>
          data-testid={GoalFormTestId.MaxRuns}
          hint={t("budgetHint")}
          label={t("maxRuns")}
          min={1}
          name="maxRuns"
          type="number"
        />
        <FormTextInput<GoalFormValues>
          data-testid={GoalFormTestId.MaxCost}
          hint={t("budgetHint")}
          label={t("maxCost")}
          min={0}
          name="maxCost"
          step="any"
          type="number"
        />
      </Grid>

      <FormSegmentPicker<GoalFormValues>
        hint={t("ceilingHint")}
        label={t("ceiling")}
        name="ceiling"
        options={[
          { value: "tier1", label: t("ceilingOption.tier1") },
          { value: "tier2", label: t("ceilingOption.tier2") },
          { value: "tier3", label: t("ceilingOption.tier3") },
        ]}
      />

      {error && (
        <Alert data-testid={GoalFormTestId.Error} severity="error">
          {error}
        </Alert>
      )}
      <Stack align="center" direction="row" gap="100" justify="end">
        <Button data-testid={GoalFormTestId.Cancel} intent="ghost" onClick={onCancel}>
          {tk("common.cancel")}
        </Button>
        <Button
          data-testid={GoalFormTestId.Submit}
          disabled={!canSubmit}
          icon="check"
          intent="primary"
          loading={pending}
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      </Stack>
    </Stack>,
  );
}
