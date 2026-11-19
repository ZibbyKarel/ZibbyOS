import { ButtonGroup } from "../../ButtonGroup/ButtonGroup";
import { SegmentedControl } from "../../SegmentedControl/SegmentedControl";
import { Field, type SelectOption } from "../Field";

export interface SegmentPickerFieldProps {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  /** Dense inspector density: a full-width `SegmentedControl` instead of the boxed `ButtonGroup`. */
  compact?: boolean;
}

/** Labelled segmented chooser — a `Field` wrapping a single-select `ButtonGroup`. */
export function SegmentPickerField({
  label,
  hint,
  error,
  value,
  options,
  onValueChange,
  compact = false,
}: SegmentPickerFieldProps) {
  return (
    <Field error={error} hint={hint} label={label}>
      {({ labelId, describedBy }) =>
        compact ? (
          <SegmentedControl
            fill
            ariaLabelledby={labelId}
            items={options.map((o) => ({ value: o.value, label: o.label }))}
            onChange={onValueChange}
            size="sm"
            value={value}
          />
        ) : (
          <ButtonGroup
            ariaDescribedby={describedBy}
            ariaLabelledby={labelId}
            onChange={onValueChange}
            options={options.map((o) => ({ id: o.value, label: o.label }))}
            value={value}
          />
        )
      }
    </Field>
  );
}
