import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Stack } from "../Stack/Stack";
import { Pressable } from "../Pressable/Pressable";

export type AlertSeverity = "info" | "ok" | "warn" | "error";

export enum AlertTestId {
  Root = "alert-root",
  Title = "alert-title",
  CloseButton = "alert-close-button",
}

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "className"> {
  severity?: AlertSeverity;
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}

// Bridge banner (`.park`/`.sug`): an opaque state-tinted surface with a soft state
// border; body text stays ink-2, only the title carries the state colour.
const severityClasses: Record<AlertSeverity, string> = {
  info: "bg-run-solid border-run/25",
  ok: "bg-ok-solid border-ok/25",
  warn: "bg-warn-solid border-warn/25",
  error: "bg-bad-solid border-bad/25",
};

const titleClasses: Record<AlertSeverity, string> = {
  info: "text-run",
  ok: "text-ok",
  warn: "text-accent-fg",
  error: "text-bad",
};

/** Severities that interrupt/warn get the assertive `alert` role; informational
 *  ones get the polite `status` role — screen readers announce `alert` content
 *  immediately, which would be noisy for routine info/ok messages. */
const roleBySeverity: Record<AlertSeverity, "alert" | "status"> = {
  info: "status",
  ok: "status",
  warn: "alert",
  error: "alert",
};

export function Alert({ severity = "info", title, onClose, children, ...rest }: AlertProps) {
  return (
    <div
      data-testid={AlertTestId.Root}
      {...rest}
      className={cn("px-[14px] py-[10px] rounded border text-ink-2", severityClasses[severity])}
      role={roleBySeverity[severity]}
    >
      <Stack direction="row" gap="150">
        <div className="flex-1 text-[12.5px] leading-relaxed">
          {title && (
            <div
              className={cn("font-medium mb-0.5", titleClasses[severity])}
              data-testid={AlertTestId.Title}
            >
              {title}
            </div>
          )}
          {children}
        </div>
        {onClose && (
          <Pressable aria-label="Dismiss" data-testid={AlertTestId.CloseButton} onClick={onClose}>
            ✕
          </Pressable>
        )}
      </Stack>
    </div>
  );
}
