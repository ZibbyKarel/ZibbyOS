"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Button,
  CardSkeleton,
  Container,
  EmptyState,
  Grid,
  ListHeader,
  ListToolbar,
  MarketplaceCard,
  Stack,
} from "@zibby/design-system";
import { QueryError } from "../../../components/LoadError/QueryError";
import { ConnectMarketplaceDialog } from "../components/ConnectMarketplaceDialog";
import { useMarketplacesQuery } from "../queries";

export enum MarketplacesListScreenTestId {
  Connect = "marketplaces-connect",
  Empty = "marketplaces-empty",
  Skeleton = "marketplaces-skeleton",
  Browse = "marketplaces-browse",
}

type Filter = "all" | "dev" | "regular";
const FILTERS: readonly Filter[] = ["all", "dev", "regular"];

/** `/workforce/marketplaces` — connected Claude Code plugin marketplaces. */
export function MarketplacesListScreen() {
  const t = useTranslations("marketplaces");
  const tl = useTranslations("marketplaces.list");
  const router = useRouter();
  const query = useMarketplacesQuery();
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const marketplaces = query.data ?? [];
  const loading = query.isPending;

  const kindOf = (devMode: boolean): Filter => (devMode ? "dev" : "regular");
  const countOf = (f: Filter) =>
    f === "all" ? marketplaces.length : marketplaces.filter((m) => kindOf(m.devMode) === f).length;
  const shown =
    filter === "all" ? marketplaces : marketplaces.filter((m) => kindOf(m.devMode) === filter);
  const totalPlugins = marketplaces.reduce((n, m) => n + m.pluginCount, 0);
  const totalInstalled = marketplaces.reduce((n, m) => n + m.installedCount, 0);

  const connectButton = (
    <Button
      data-testid={MarketplacesListScreenTestId.Connect}
      icon="plus"
      intent="ink"
      onClick={() => setConnecting(true)}
    >
      {t("connect")}
    </Button>
  );

  const open = (id: string) => router.push(`/workforce/marketplaces/${id}` as Route);

  return (
    <Container padding={["300", "350"]}>
      <Stack gap="200">
        <ListHeader
          actions={connectButton}
          count={
            loading
              ? []
              : [
                  { text: tl("count.catalogs", { count: marketplaces.length }), tone: "plain" },
                  {
                    text: tl("count.installed", { installed: totalInstalled, total: totalPlugins }),
                    tone: "plain",
                  },
                ]
          }
          route="/workforce/marketplaces"
          section={tl("section")}
          title={tl("title")}
        />

        {!loading && marketplaces.length > 0 && (
          <ListToolbar
            activeChip={filter}
            chips={FILTERS.map((f) => ({ id: f, label: tl(`filter.${f}`), count: countOf(f) }))}
            onChipChange={(id) => setFilter(id as Filter)}
          />
        )}

        {loading ? (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {[0, 1, 2].map((i) => (
              <span data-testid={MarketplacesListScreenTestId.Skeleton} key={i}>
                <CardSkeleton shape="card" />
              </span>
            ))}
          </Grid>
        ) : query.isError ? (
          <QueryError onRetry={() => void query.refetch()} />
        ) : marketplaces.length === 0 ? (
          <EmptyState
            action={connectButton}
            body={t("emptyDescription")}
            data-testid={MarketplacesListScreenTestId.Empty}
            icon="grid"
            title={t("emptyTitle")}
          />
        ) : (
          <Grid cols={1} gap="200" lg={3} sm={2}>
            {shown.map((m) => (
              <MarketplaceCard
                footer={
                  <Button
                    data-testid={MarketplacesListScreenTestId.Browse}
                    intent="secondary"
                    onClick={() => open(m.id)}
                    size="sm"
                  >
                    {tl("browse")}
                  </Button>
                }
                installed={m.installedCount}
                installedText={[
                  tl("installedBefore"),
                  tl("installedAfter", { total: m.pluginCount }),
                ]}
                key={m.id}
                kind={m.devMode ? "dev" : "regular"}
                kindLabel={m.devMode ? t("devBadge") : t("normalBadge")}
                name={m.id}
                onOpen={() => open(m.id)}
                openLabel={t("openAria", { name: m.id })}
                source={m.source}
                total={m.pluginCount}
              />
            ))}
          </Grid>
        )}
      </Stack>

      {connecting && (
        <ConnectMarketplaceDialog
          onClose={() => setConnecting(false)}
          onConnected={(id) => router.push(`/workforce/marketplaces/${id}` as Route)}
        />
      )}
    </Container>
  );
}
