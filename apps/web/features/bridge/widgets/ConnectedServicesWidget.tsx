"use client";

import { ConnectedServicesList } from "../../connected-services/components/ConnectedServicesList";
import { useConnectedServicesQuery } from "../../connected-services/queries";
import type { BridgeWidgetProps } from "./registry";
import { useWidgetReport } from "./useWidgetReport";

/**
 * Connected services on the bridge: the shared {@link ConnectedServicesList} (it owns the
 * sign-in polling). The header pill counts the disconnected ones.
 */
export function ConnectedServicesWidget({
  widget,
  onEmptyChange,
  onCountChange,
}: BridgeWidgetProps) {
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

  return <ConnectedServicesList rowKeyPrefix={widget.id} />;
}
