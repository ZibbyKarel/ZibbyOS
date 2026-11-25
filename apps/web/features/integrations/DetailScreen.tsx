"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Container,
  Panel,
  SelectField,
  Stack,
  type SubNavLinkComponent,
  Typography,
} from "@zibby/design-system";
import { PageBreadcrumb } from "../../components/layout/PageBreadcrumb";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog/ConfirmDeleteDialog";
import type { Integration } from "@zibby/contracts";
import { QueryError } from "../../components/LoadError/QueryError";
import { QueryLoading } from "../../components/LoadingState/QueryLoading";
import { PageContainer } from "../../components/PageContainer/PageContainer";
import { IntegrationAutonomyPanel } from "./components/IntegrationAutonomyPanel";
import { TokenExpiryLabel } from "./components/TokenExpiryLabel";
import { IntegrationFormFields, useIntegrationFormState } from "./components/IntegrationFormFields";
import { useCompaniesQuery } from "../companies";
import { accountHref, accountOwnerHref } from "./accountHref";
import {
  useDeleteIntegrationMutation,
  useSetCredentialsMutation,
  useTestIntegrationMutation,
  useUpdateIntegrationMutation,
} from "./mutations";
import { useIntegrationQuery } from "./queries";

export enum IntegrationDetailScreenTestId {
  Save = "integration-detail-save",
  Test = "integration-detail-test",
  Delete = "integration-detail-delete",
  TestResult = "integration-detail-test-result",
}

export interface IntegrationDetailScreenProps {
  integrationId: string;
}

/** Placeholder value for "personal" in the owner select — a real company id is never empty. */
const PERSONAL = "";

/**
 * An account's detail page — `/companies/:id/integrations/:integrationId` for a company
 * account, `/system/settings/accounts/:integrationId` for a personal one. The card's
 * Configure action NAVIGATES here; the page IS the edit surface (the same
 * {@link IntegrationFormFields} the connect wizard renders; kind + id locked), Save / Test /
 * Delete sit top-right, delete asks in a confirm dialog. The owner select moves the account
 * to a company or to the operator, then follows it to its new route. A freshly entered
 * secret rides out-of-band through the separate credentials mutation (email → `password`,
 * everything else → `token`).
 */
export function DetailScreen({ integrationId }: IntegrationDetailScreenProps) {
  const query = useIntegrationQuery(integrationId);
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <QueryLoading />;
  if (!query.data) return null;
  // The form captures its defaults at mount — key by integration so a different id remounts.
  return <IntegrationEditor integration={query.data} key={query.data.id} />;
}

function IntegrationEditor({ integration }: { integration: Integration }) {
  const t = useTranslations();
  const router = useRouter();
  const updateIntegration = useUpdateIntegrationMutation();
  const deleteIntegration = useDeleteIntegrationMutation();
  const setCredentials = useSetCredentialsMutation();
  const testIntegration = useTestIntegrationMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const { data: companies = [] } = useCompaniesQuery();
  const form = useIntegrationFormState({ companyId: integration.companyId }, integration);

  const name = integration.name ?? integration.id;
  const backHref = accountOwnerHref(integration);

  const moveTo = (owner: string) =>
    updateIntegration.mutate(
      { params: { id: integration.id }, body: { companyId: owner === PERSONAL ? null : owner } },
      {
        onSuccess: () =>
          router.replace(
            accountHref({ id: integration.id, companyId: owner === PERSONAL ? undefined : owner }),
          ),
      },
    );

  const save = () => {
    updateIntegration.mutate(
      { params: { id: integration.id }, body: form.buildPatch() },
      {
        onSuccess: () => {
          const secret = form.newSecret();
          if (secret) {
            setCredentials.mutate({
              params: { id: integration.id },
              // Email authenticates with a password; Slack/Jira/GitHub all carry a token.
              body: integration.kind === "email" ? { password: secret } : { token: secret },
            });
          }
        },
      },
    );
  };

  const test = () => {
    setTestResult(null);
    testIntegration.mutate(
      { params: { id: integration.id }, body: {} },
      {
        onSuccess: ({ body }) => setTestResult({ ok: body.ok, detail: body.detail }),
        onError: () => setTestResult({ ok: false, detail: t("integrations.testFailed") }),
      },
    );
  };

  return (
    <Container padding={["300", "350"]}>
      <PageContainer>
        <Stack gap="250">
          <PageBreadcrumb
            items={[
              {
                label: integration.companyId
                  ? t("companies.integrations.title")
                  : t("settings.accounts.title"),
                href: backHref,
              },
              { label: name },
            ]}
            linkComponent={Link as SubNavLinkComponent}
          />

          <Stack wrap align="center" direction="row" gap="150" justify="between">
            <Stack gap="50">
              <Typography type="h1">{name}</Typography>
              <TokenExpiryLabel tokenExpiresAt={integration.tokenExpiresAt} />
            </Stack>
            <Stack align="center" direction="row" gap="100">
              <Button
                data-testid={IntegrationDetailScreenTestId.Test}
                icon="pulse"
                intent="ghost"
                loading={testIntegration.isPending}
                onClick={test}
                size="sm"
              >
                {t("integrations.testConnection")}
              </Button>
              <Button
                data-testid={IntegrationDetailScreenTestId.Delete}
                icon="trash"
                intent="danger"
                onClick={() => setConfirmDelete(true)}
                size="sm"
              >
                {t("common.delete")}
              </Button>
              <Button
                data-testid={IntegrationDetailScreenTestId.Save}
                disabled={!form.canSave(false)}
                icon="check"
                intent="primary"
                loading={updateIntegration.isPending}
                onClick={save}
                size="sm"
              >
                {t("common.save")}
              </Button>
            </Stack>
          </Stack>

          {testResult && (
            <Alert
              data-testid={IntegrationDetailScreenTestId.TestResult}
              onClose={() => setTestResult(null)}
              severity={testResult.ok ? "ok" : "error"}
            >
              {testResult.detail}
            </Alert>
          )}

          <Panel header={t("integrations.detailPanel")} padding="200">
            <Stack gap="150">
              <SelectField
                hint={t("integrations.ownerHint")}
                label={t("integrations.ownerLabel")}
                onValueChange={moveTo}
                options={[
                  { value: PERSONAL, label: t("integrations.ownerPersonal") },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={integration.companyId ?? PERSONAL}
              />
              <IntegrationFormFields
                kindLocked
                form={form}
                hasCredentials={integration.hasCredentials}
              />
            </Stack>
          </Panel>

          <IntegrationAutonomyPanel integrationId={integration.id} />
        </Stack>
      </PageContainer>

      {confirmDelete && (
        <ConfirmDeleteDialog
          body={t("integrations.deleteBody", { name })}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            deleteIntegration.mutate(
              { params: { id: integration.id } },
              { onSuccess: () => router.push(backHref) },
            )
          }
          pending={deleteIntegration.isPending}
          title={t("integrations.deleteTitle")}
        />
      )}
    </Container>
  );
}
