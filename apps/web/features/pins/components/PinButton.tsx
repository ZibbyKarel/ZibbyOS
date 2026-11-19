"use client";

import type { EntityPinKind } from "@zibby/contracts";
import { Button } from "@zibby/design-system";
import { useTranslations } from "next-intl";
import { usePinToggle } from "../usePinToggle";

export interface PinButtonProps {
  kind: EntityPinKind;
  id: string;
  /** Icon-only (the label stays as the accessible name) — for a dense breadcrumb bar. */
  iconOnly?: boolean;
}

/** Top-right pin/unpin toggle for an agent/workflow/chain detail page —
 *  same action-row position as Run/Edit/Delete on every detail screen. */
export function PinButton({ kind, id, iconOnly = false }: PinButtonProps) {
  const t = useTranslations("pins");
  const { isPinned, toggle, isPending } = usePinToggle();
  const pinned = isPinned(kind, id);
  return (
    <Button
      aria-label={iconOnly ? t(pinned ? "unpin" : "pin") : undefined}
      icon="pin"
      intent="ghost"
      loading={isPending}
      onClick={() => toggle(kind, id)}
      size="sm"
    >
      {iconOnly ? undefined : t(pinned ? "unpin" : "pin")}
    </Button>
  );
}
