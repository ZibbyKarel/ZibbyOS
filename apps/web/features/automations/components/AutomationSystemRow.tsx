import type { Automation } from "@zibby/contracts";
import { Button, DenseRow, StatusDot, Toggle, Typography } from "@zibby/design-system";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SystemAutomationRowTestId } from "../../settings/components/SystemAutomationRow";
import { relativeLabel } from "../schedule";
import { useCronLabel } from "../useCronLabel";

export interface AutomationSystemRowProps {
  automation: Automation;
  onToggle: () => void;
  onEdit: () => void;
  onTrigger: () => void;
  triggering?: boolean;
}

/** A server-seeded system automation as a dense list row: schedule, last fired, quick actions and the switch. */
export function AutomationSystemRow({
  automation,
  onToggle,
  onEdit,
  onTrigger,
  triggering,
}: AutomationSystemRowProps) {
  const t = useTranslations("automations");
  const locale = useLocale();
  const cronLabel = useCronLabel();
  const [now] = useState(() => Date.now());
  const { trigger, enabled } = automation;
  const name = automation.name ?? automation.id;
  const scheduleText =
    trigger.type === "cron"
      ? cronLabel(trigger.expr)
      : trigger.type === "signal"
        ? trigger.kind
        : trigger.events.join(", ");
  const lastLabel = automation.lastFiredAt
    ? t("lastRun", { ago: relativeLabel(Date.parse(automation.lastFiredAt), now, locale) })
    : t("neverRun");

  return (
    <DenseRow
      cells={[
        <>
          {scheduleText}
          {trigger.type === "cron" && (
            <Typography mono size="2xs" type="micro" variant="tertiary">
              {trigger.expr}
            </Typography>
          )}
        </>,
        <Typography mono key="last" size="2xs" type="micro" variant="tertiary">
          {enabled ? lastLabel : t("nextOff")}
        </Typography>,
      ]}
      dot={<StatusDot tone={enabled ? "ok" : "idle"} />}
      hint={automation.description}
      onOpen={onEdit}
      testId={SystemAutomationRowTestId.Root}
      title={name}
      trailing={
        <>
          <Button
            aria-label={`${t("edit")}: ${name}`}
            data-testid={SystemAutomationRowTestId.Edit}
            icon="edit"
            intent="ghost"
            onClick={onEdit}
            size="sm"
          />
          <Button
            aria-label={`${t("runNow")}: ${name}`}
            data-testid={SystemAutomationRowTestId.Run}
            icon="play"
            intent="ghost"
            loading={triggering}
            onClick={onTrigger}
            size="sm"
          />
          <Toggle
            checked={enabled}
            data-testid={SystemAutomationRowTestId.Toggle}
            label={t("toggleLabel", { name })}
            onChange={onToggle}
            size="sm"
          />
        </>
      }
    />
  );
}
