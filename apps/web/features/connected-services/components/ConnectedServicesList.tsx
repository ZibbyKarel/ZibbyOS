"use client";

import type { ConnectedService } from "@zibby/contracts";
import { Button, Grid, Icon, ReadingItem, Stack, Typography } from "@zibby/design-system";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QueryError } from "../../../components/LoadError/QueryError";
import { useConnectServiceMutation } from "../mutations";
import { useConnectedServicesQuery } from "../queries";

export enum ConnectedServicesListTestId {
  Connect = "connected-services-connect",
  Status = "connected-services-status",
  Edit = "connected-services-edit",
  Icon = "connected-services-icon",
}

/** How long after a Connect click the list keeps polling for the sign-in to land. */
export const CONNECT_POLL_WINDOW_MS = 3 * 60_000;

export interface ConnectedServicesListProps {
  /** Prefix for each row's `rowKey` (the bridge widget id, or the settings panel). */
  rowKeyPrefix: string;
  /** Shows a per-row edit button (Settings → Accounts); the bridge widget leaves it out. */
  onEdit?: (service: ConnectedService) => void;
}

/**
 * The service's icon: its `iconUrl`, else the landing page's favicon, else the generic plug.
 * Local `<img>` on purpose: the DS `Avatar` has no failing-src fallback and is a person's
 * round picture, not a site icon.
 */
function ServiceIcon({ service }: { service: ConnectedService }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Icon name="plug" size="md" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote favicon, no optimisation wanted
    <img
      alt=""
      data-testid={ConnectedServicesListTestId.Icon}
      height={16}
      onError={() => setFailed(true)}
      src={service.iconUrl ?? new URL("/favicon.ico", service.landingUrl).href}
      width={16}
    />
  );
}

/**
 * Connected services (KDP, MakerWorld …): one row per service (two columns), its status a green check or a red cross. Connected rows open the service
 * in a new tab; a disconnected row's Connect launches its login in Chrome and the list is polled
 * (5s, up to 3 min) until it turns connected. Shared by the bridge widget and Settings → Accounts.
 */
export function ConnectedServicesList({ rowKeyPrefix, onEdit }: ConnectedServicesListProps) {
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
    <Grid cols={2}>
      {services.map((s) => {
        const isConnected = s.status === "connected";
        const pending = connect.isPending && connect.variables?.params.id === s.id;
        return (
          <ReadingItem
            action={
              <Stack align="center" direction="row" gap="50">
                {isConnected ? null : (
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
                )}
                {onEdit ? (
                  <Button
                    aria-label={t("editLabel", { name: s.name })}
                    data-testid={ConnectedServicesListTestId.Edit}
                    icon="edit"
                    intent="ghost"
                    onClick={() => onEdit(s)}
                    size="sm"
                  />
                ) : null}
              </Stack>
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
                <Icon
                  aria-hidden={false}
                  aria-label={t(isConnected ? "connected" : "disconnected")}
                  name={isConnected ? "check" : "x"}
                  role="img"
                  size="sm"
                  tone={isConnected ? "ok" : "bad"}
                />
                {/* The agents can't open the profile while that Chrome window is open. */}
                {!isConnected && signingIn.has(s.id) ? (
                  <Typography as="span" size="xs" type="note">
                    {t("signInHint")}
                  </Typography>
                ) : null}
              </Stack>
            }
            text={
              <Stack align="center" direction="row" gap="75">
                <ServiceIcon service={s} />
                {s.name}
              </Stack>
            }
          />
        );
      })}
    </Grid>
  );
}
