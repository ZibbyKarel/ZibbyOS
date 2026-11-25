"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Alert, Grid, Stack, Typography } from "@zibby/design-system";
import type { Integration } from "@zibby/contracts";
import { useTestIntegrationMutation, useUpdateIntegrationMutation } from "..";
import { accountHref } from "../accountHref";
import { IntegrationCard } from "./IntegrationCard";

export enum AccountCardsTestId {
  Empty = "account-cards-empty",
  TestResult = "account-cards-test-result",
}

export interface AccountCardsProps {
  integrations: readonly Integration[];
  /** Shown when there are no accounts. */
  emptyLabel: string;
}

/**
 * The account cards of a company or of the operator: test / enable quick actions, Configure
 * NAVIGATES to the account's detail page (company- or settings-nested, by owner).
 */
export function AccountCards({ integrations, emptyLabel }: AccountCardsProps) {
  const t = useTranslations();
  const router = useRouter();
  const update = useUpdateIntegrationMutation();
  const test = useTestIntegrationMutation();
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);

  const onTest = (integration: Integration) => {
    setTestResult(null);
    test.mutate(
      { params: { id: integration.id }, body: {} },
      {
        onSuccess: ({ body }) => setTestResult({ ok: body.ok, detail: body.detail }),
        onError: () => setTestResult({ ok: false, detail: t("integrations.testFailed") }),
      },
    );
  };

  return (
    <Stack gap="150">
      {testResult && (
        <Alert
          data-testid={AccountCardsTestId.TestResult}
          onClose={() => setTestResult(null)}
          severity={testResult.ok ? "ok" : "error"}
        >
          {testResult.detail}
        </Alert>
      )}
      {integrations.length === 0 ? (
        <Typography data-testid={AccountCardsTestId.Empty} size="sm" type="note" variant="tertiary">
          {emptyLabel}
        </Typography>
      ) : (
        <Grid align="stretch" cols={1} gap="150" lg={3} md={2}>
          {integrations.map((i) => (
            <IntegrationCard
              integration={i}
              key={i.id}
              onConfigure={(integration) => router.push(accountHref(integration))}
              onTest={onTest}
              onToggleEnabled={(integration) =>
                update.mutate({
                  params: { id: integration.id },
                  body: { enabled: !integration.enabled },
                })
              }
              testing={test.isPending}
              togglingEnabled={update.isPending}
            />
          ))}
        </Grid>
      )}
    </Stack>
  );
}
