"use client";

import type { ConnectedService } from "@zibby/contracts";
import { Button, ReadingItem, Stack, StatusDot } from "@zibby/design-system";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useConnectServiceMutation } from "../mutations";
import { useConnectedServicesQuery } from "../queries";

export enum ConnectedServicesListTestId {
  Connect = "connected-services-connect",
  Status = "connected-services-status",
}

/** How long after a Connect click the list keeps polling for the sign-in to land. */
export const CONNECT_POLL_WINDOW_MS = 3 * 60_000;

export interface ConnectedServicesListProps {
  /** Prefix for each row's `rowKey` (the bridge widget id, or the settings panel). */
  rowKeyPrefix: string;
}

/**
 * Connected services (KDP, MakerWorld …): one row per service. Connected rows open the service
 * in a new tab; a disconnected row's Connect launches its login in Chrome and the list is polled
 * (5s, up to 3 min) until it turns connected. Shared by the bridge widget and Settings → Accounts.
 */
export function ConnectedServicesList({ rowKeyPrefix }: ConnectedServicesListProps) {
  const t = useTranslations("bridge.widgets.connectedServices");
  const clicked = useRef<Record<string, number>>({});
  const [signingIn, setSigningIn] = useState<ReadonlySet<string>>(new Set());
  const query = useConnectedServicesQuery((services) =>
    services.some(
      (s) =>
        s.status === "disconnected" &&
        Date.now() - (clicked.current[s.id] ?? -Infinity) < CONNECT_POLL_WINDOW_MS,
    ),
  );
  const connect = useConnectServiceMutation();
  const services: ConnectedService[] = query.data ?? [];

  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;

  return (
    <>
      {services.map((s) => {
        const isConnected = s.status === "connected";
        const pending = connect.isPending && connect.variables?.params.id === s.id;
        return (
          <ReadingItem
            action={
              isConnected ? undefined : (
                <Button
                  aria-label={t("connectLabel", { name: s.name })}
                  data-testid={ConnectedServicesListTestId.Connect}
                  intent="ghost"
                  loading={pending}
                  onClick={() => {
                    clicked.current[s.id] = Date.now();
                    setSigningIn((prev) => new Set(prev).add(s.id));
                    connect.mutate({ params: { id: s.id } });
                  }}
                  size="sm"
                >
                  {pending ? t("connecting") : t("connect")}
                </Button>
              )
            }
            key={s.id}
            onClick={
              isConnected
                ? () => window.open(s.landingUrl, "_blank", "noopener,noreferrer")
                : undefined
            }
            rowKey={`${rowKeyPrefix}:${s.id}`}
            sub={
              <Stack
                align="center"
                data-testid={ConnectedServicesListTestId.Status}
                direction="row"
                gap="50"
              >
                <StatusDot size="50" tone={isConnected ? "done" : "blocked"} />
                {t(
                  isConnected
                    ? "connected"
                    : // The agents can't open the profile while that Chrome window is open.
                      signingIn.has(s.id)
                      ? "signInHint"
                      : "disconnected",
                )}
              </Stack>
            }
            text={s.name}
          />
        );
      })}
    </>
  );
}
