"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Stack } from "@zibby/design-system";
import { ConnectedServiceDialog } from "../../connected-services/components/ConnectedServiceDialog";
import { ConnectedServicesList } from "../../connected-services/components/ConnectedServicesList";
import { useConnectedServicesQuery } from "../../connected-services/queries";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

/**
 * Connected services on the bridge: the shared {@link ConnectedServicesList} (it owns the
 * sign-in polling). The header pill counts the disconnected ones.
 */
export enum ConnectedServicesWidgetTestId {
  Add = "connected-services-widget-add",
}

export function ConnectedServicesWidget({
  widget,
  onEmptyChange,
  onCountChange,
}: BridgeWidgetProps) {
  const t = useTranslations("bridge.widgets.connectedServices");
  const [adding, setAdding] = useState(false);
  const query = useConnectedServicesQuery();
  const services = query.data ?? [];

  useWidgetReport(
    {
      loading: query.isPending,
      count: query.isPending ? undefined : services.length,
      you: services.filter((s) => s.status === "disconnected").length,
      failed: query.isError,
    },
    { onEmptyChange, onCountChange },
  );

  return (
    <Stack gap="100">
      <ConnectedServicesList rowKeyPrefix={widget.id} />
      <Stack direction="row" justify="end">
        <Button
          data-testid={ConnectedServicesWidgetTestId.Add}
          icon="plus"
          intent="ghost"
          onClick={() => setAdding(true)}
          size="sm"
        >
          {t("add")}
        </Button>
      </Stack>
      {adding && <ConnectedServiceDialog onClose={() => setAdding(false)} />}
    </Stack>
  );
}
