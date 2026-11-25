"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ConnectionAddTile,
  ConnectionRibbon,
  type ConnectionRibbonItem,
  ConnectionStrip,
  ConnectionTile,
  IconTile,
} from "@zibby/design-system";
import type { Integration } from "@zibby/contracts";
import { compactAgo } from "../../../utils/time";
import { type EntityT, useEntityT } from "../../entity/useEntityT";
import type { ConnectionTileModel, ConnectionsModel } from "../connectionsModel";
import { INTEGRATION_ACCENT, INTEGRATION_KIND_LABEL_KEY, sourceIcon } from "../kindIcon";

/** The detail line a connection shows (host, repo, channel count...). */
export function integrationDetail(i: Integration, t: EntityT): string {
  const c = i.config;
  switch (c.kind) {
    case "slack":
      return t("connections.channels", { count: c.channels.length });
    case "email":
      return c.user;
    case "jira":
      return c.projectKey ?? c.baseUrl;
    case "github":
    case "gitlab":
      return c.repo ?? `@${c.username}`;
    case "calendar":
      return c.calendarId;
    default:
      return `${c.org}/${c.project}`;
  }
}

export interface EntityConnectionsProps {
  model: ConnectionsModel;
  ribbon: ConnectionRibbonItem[];
  /** Name of the company that owns inherited company tiles (personal ones read "Personal"). */
  companyName?: string | undefined;
  /** Hide the "Connect" tile (a project / team has no accounts of its own). */
  canConnect?: boolean;
  onConnect: () => void;
  onOpen: (integration: Integration) => void;
}

/** The connections strip of a company / project / team page. */
export function EntityConnections({
  model,
  ribbon,
  companyName,
  canConnect = true,
  onConnect,
  onOpen,
}: EntityConnectionsProps) {
  const t = useEntityT();
  const tk = useTranslations();
  const [now] = useState(() => Date.now());

  const tileProps = (tile: ConnectionTileModel) => {
    const i = tile.integration;
    const icon = sourceIcon(i.kind);
    const status =
      tile.health === "bad"
        ? tile.expiresInDays === 0
          ? t("connections.expired")
          : t("connections.error")
        : tile.health === "warn"
          ? t("connections.expires", { days: tile.expiresInDays ?? 0 })
          : tile.health === "off"
            ? i.enabled
              ? t("connections.disconnected")
              : t("connections.disabled")
            : t("connections.connected");
    const meta = [
      i.lastSyncAt
        ? t("connections.synced", { ago: compactAgo(i.lastSyncAt, now) })
        : t("connections.neverSynced"),
      integrationDetail(i, t),
    ];
    return {
      key: i.id,
      name: i.name ?? tk(INTEGRATION_KIND_LABEL_KEY[i.kind]),
      mark: <IconTile alt="" glyph={icon.glyph} size="sm" src={icon.src} />,
      status,
      health: tile.health,
      meta,
      origin: tile.origin,
      ownLabel: t("connections.ownChip"),
      sourceLabel: i.companyId
        ? t("connections.from", { name: companyName ?? i.companyId })
        : t("connections.personal"),
      serves: tile.serves > 0 ? t("connections.serves", { count: tile.serves }) : undefined,
      accent: INTEGRATION_ACCENT[i.kind],
      onClick: () => onOpen(i),
    };
  };

  const attention = model.attention.length;
  return (
    <ConnectionStrip
      inheritedLabel={t("connections.inheritedLegend")}
      label={t("connections.label")}
      ownLabel={t("connections.ownLegend")}
      ribbon={<ConnectionRibbon ariaLabel={t("connections.ribbonAria")} items={ribbon} />}
      summary={
        attention > 0
          ? t("connections.summaryAttention", { connected: model.connected, count: attention })
          : t("connections.summary", { connected: model.connected })
      }
    >
      {model.tiles.map((tile) => {
        const { key, ...p } = tileProps(tile);
        return <ConnectionTile key={key} {...p} />;
      })}
      {canConnect && (
        <ConnectionAddTile
          hint={t("connections.connectHint")}
          label={t("connections.connect")}
          onClick={onConnect}
        />
      )}
    </ConnectionStrip>
  );
}
