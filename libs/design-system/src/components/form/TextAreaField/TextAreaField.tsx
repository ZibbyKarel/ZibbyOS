import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "../../../utils/cn";
import { Field, type FieldControlSize, fieldControlClassFor } from "../Field";

export enum TextAreaFieldTestId {
  Control = "text-area-control",
  /** The component renders a single node (the control itself) — `Root` aliases
   *  `Control` so every field component's enum has a `Root` to select on. */
  Root = Control,
}

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "className"
> {
  label: string;
  hint?: string;
  error?: string;
  /** Control density; `sm` is the dense side-card row. Default `md`. */
  size?: FieldControlSize;
  /** Keep the label for assistive tech but hide it visually (the host already titles the field). */
  hideLabel?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Labelled multi-line text input. */
export function TextAreaField({
  label,
  hint,
  error,
  size,
  hideLabel,
  ref,
  ...props
}: TextAreaFieldProps) {
  return (
    <Field error={error} hideLabel={hideLabel} hint={hint} label={label}>
      {({ id, describedBy, invalid }) => (
        <textarea
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(fieldControlClassFor(size), "min-h-20 resize-y leading-relaxed")}
          data-testid={TextAreaFieldTestId.Control}
          id={id}
          ref={ref}
          {...props}
        />
      )}
    </Field>
  );
}
