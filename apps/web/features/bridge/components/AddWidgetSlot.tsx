"use client";

import { Button, MenuButton, WidgetPlaceholder } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { type CSSProperties, useEffect } from "react";
import type { WidgetType } from "../grid/layout";
import { WIDGETS, WIDGET_TYPES } from "../widgets/registry";

export interface AddWidgetSlotProps {
  style: CSSProperties;
  onPick: (type: WidgetType) => void;
  /** The picker opened / closed — the board keeps the slot while it is open. */
  onOpenChange: (open: boolean) => void;
}

function OpenReporter({ open, onChange }: { open: boolean; onChange: (open: boolean) => void }) {
  useEffect(() => {
    if (!open) return;
    onChange(true);
    return () => onChange(false);
  }, [open, onChange]);
  return null;
}

/** The ghost widget on a hovered empty spot: "Add widget" opens the type picker. */
export function AddWidgetSlot({ style, onPick, onOpenChange }: AddWidgetSlotProps) {
  const t = useTranslations("bridge");
  const tRoot = useTranslations();
  return (
    <WidgetPlaceholder style={style}>
      <MenuButton
        ariaLabel={t("addWidget")}
        // Every type, even ones already on the board — a widget type can have several instances.
        items={WIDGET_TYPES.map((type) => ({
          id: type,
          label: tRoot(WIDGETS[type].labelKey),
          description: tRoot(WIDGETS[type].descKey),
          icon: WIDGETS[type].icon,
          onSelect: () => onPick(type),
        }))}
        renderTrigger={(triggerProps, open) => (
          <>
            <OpenReporter onChange={onOpenChange} open={open} />
            <Button {...triggerProps} icon="plus" intent="ghost" size="sm">
              {t("addWidget")}
            </Button>
          </>
        )}
      />
    </WidgetPlaceholder>
  );
}
