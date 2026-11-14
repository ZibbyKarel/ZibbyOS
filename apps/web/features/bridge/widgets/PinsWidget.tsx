"use client";

import type { Pin } from "@zibby/contracts";
import { type IconName, LauncherGrid, LauncherTile } from "@zibby/design-system";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAgentsQuery } from "../../agents/queries";
import { usePinsQuery } from "../../pins";
import { useWorkflowsQuery } from "../../workflows";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

type Named = { id: string; name?: string };

/** Where a pin leads and what it is called. Entity names are read live from the catalog
 *  (falling back to the id when the entity is gone); a page pin carries its own label. */
function resolve(pin: Pin, workflows: Named[], agents: Named[]) {
  if (pin.kind === "page") return { href: pin.id, label: pin.label };
  if (pin.kind === "workflow")
    return {
      href: `/work/workflows/${pin.id}`,
      label: workflows.find((w) => w.id === pin.id)?.name ?? pin.id,
    };
  return {
    href: `/workforce/agents/${pin.id}`,
    label: agents.find((a) => a.id === pin.id)?.name ?? pin.id,
  };
}

const KIND_ICON: Record<Pin["kind"], IconName> = { page: "layout", workflow: "flow", agent: "bot" };

/** Every pin from `pins.json` (pages, workflows, agents), in pin order; a row navigates to its target. */
export function PinsWidget({ widget, onEmptyChange, onCountChange }: BridgeWidgetProps) {
  const router = useRouter();
  const t = useTranslations("bridge.widgets.pins");
  const { data: pins = [], isPending } = usePinsQuery();
  const { data: workflows = [] } = useWorkflowsQuery();
  const { data: agents = [] } = useAgentsQuery();

  useWidgetReport(
    { loading: isPending, count: pins.length, you: 0 },
    { onEmptyChange, onCountChange },
  );

  return (
    <LauncherGrid>
      {pins.map((pin) => {
        const { href, label } = resolve(pin, workflows, agents);
        return (
          <LauncherTile
            icon={KIND_ICON[pin.kind]}
            key={`${pin.kind}:${pin.id}`}
            label={label}
            onClick={() => router.push(href as Route)}
            rowKey={`${widget.id}:${pin.kind}:${pin.id}`}
            title={`${label} · ${t(`kind.${pin.kind}`)}`}
          />
        );
      })}
    </LauncherGrid>
  );
}
