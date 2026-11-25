"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, Panel, Stack, Typography } from "@zibby/design-system";
import { AccountCards } from "../../integrations/components/AccountCards";
import { ConnectWizardSheet } from "../../integrations/components/ConnectWizardSheet";
import { accountHref } from "../../integrations/accountHref";
import { useCompanyIntegrationsQuery } from "../../integrations";

export enum CompanyIntegrationsPanelTestId {
  Add = "company-add-integration",
}

export interface CompanyIntegrationsPanelProps {
  companyId: string;
  ownerName?: string;
  /** Projects that a new account would serve. */
  projectCount?: number;
}

/**
 * The company's accounts: each one is shared by every linked project, which route its items
 * with their `integrationRouting` rules. Cards with test / enable quick actions; Configure
 * NAVIGATES to the company-nested detail page; Connect opens the wizard owned by the company.
 */
export function CompanyIntegrationsPanel({
  companyId,
  ownerName,
  projectCount,
}: CompanyIntegrationsPanelProps) {
  const t = useTranslations();
  const router = useRouter();
  const { data: integrations = [] } = useCompanyIntegrationsQuery(companyId);
  const [creating, setCreating] = useState(false);

  return (
    <Panel
      header={t("companies.integrations.title")}
      headerEnd={
        <Button
          data-testid={CompanyIntegrationsPanelTestId.Add}
          icon="plus"
          intent="primary"
          onClick={() => setCreating(true)}
          size="sm"
        >
          {t("companies.integrations.add")}
        </Button>
      }
      padding="200"
    >
      <Stack gap="150">
        <Typography size="xs" type="note" variant="tertiary">
          {t("companies.integrations.hint")}
        </Typography>
        <AccountCards emptyLabel={t("companies.integrations.empty")} integrations={integrations} />
      </Stack>

      {creating && (
        <ConnectWizardSheet
          inheritingCount={projectCount}
          onClose={() => setCreating(false)}
          onOpenIntegration={(iid) => router.push(accountHref({ id: iid, companyId }))}
          owner={{ companyId }}
          ownerName={ownerName ?? companyId}
        />
      )}
    </Panel>
  );
}
