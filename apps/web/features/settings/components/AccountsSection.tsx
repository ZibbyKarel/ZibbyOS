"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, SettingsPanel, Stack, Typography } from "@zibby/design-system";
import type { ConnectedService } from "@zibby/contracts";
import { ConnectedServiceDialog } from "../../connected-services/components/ConnectedServiceDialog";
import { ConnectedServiceDeleteDialog } from "../../connected-services/components/ConnectedServiceDeleteDialog";
import { ConnectedServicesList } from "../../connected-services/components/ConnectedServicesList";
import { accountHref } from "../../integrations/accountHref";
import { AccountCards } from "../../integrations/components/AccountCards";
import { ConnectWizardSheet } from "../../integrations/components/ConnectWizardSheet";
import { usePersonalIntegrationsQuery } from "../../integrations";

export enum AccountsSectionTestId {
  Connect = "settings-accounts-connect",
  AddService = "settings-accounts-add-service",
}

/**
 * Settings → Access → Accounts: the operator's personal accounts (no owning company) and the
 * browser sign-ins of the connected services. A card opens the account's settings-nested
 * detail page; Connect opens the wizard for a personal account.
 */
export function AccountsSection() {
  const t = useTranslations("settings.accounts");
  const router = useRouter();
  const { data: accounts = [] } = usePersonalIntegrationsQuery();
  const [connecting, setConnecting] = useState(false);
  // `null` = adding a new service; a service = editing it; undefined = closed.
  const [serviceForm, setServiceForm] = useState<ConnectedService | null>();
  const [deleting, setDeleting] = useState<ConnectedService>();

  return (
    <SettingsPanel
      actions={
        <Button
          data-testid={AccountsSectionTestId.Connect}
          icon="plus"
          intent="primary"
          onClick={() => setConnecting(true)}
          size="sm"
        >
          {t("connect")}
        </Button>
      }
      description={t("description")}
      id="accounts"
      title={t("title")}
    >
      <Stack gap="250">
        <AccountCards emptyLabel={t("empty")} integrations={accounts} />
        <Stack gap="50">
          <Stack align="center" direction="row" justify="between">
            <Typography type="h3">{t("servicesTitle")}</Typography>
            <Button
              data-testid={AccountsSectionTestId.AddService}
              icon="plus"
              intent="ghost"
              onClick={() => setServiceForm(null)}
              size="sm"
            >
              {t("addService")}
            </Button>
          </Stack>
          <Typography size="xs" type="note" variant="tertiary">
            {t("servicesHint")}
          </Typography>
          <ConnectedServicesList
            onDelete={setDeleting}
            onEdit={setServiceForm}
            rowKeyPrefix="settings-accounts"
          />
        </Stack>
      </Stack>

      {serviceForm !== undefined && (
        <ConnectedServiceDialog
          onClose={() => setServiceForm(undefined)}
          service={serviceForm ?? undefined}
        />
      )}
      {deleting && (
        <ConnectedServiceDeleteDialog onClose={() => setDeleting(undefined)} service={deleting} />
      )}
      {connecting && (
        <ConnectWizardSheet
          onClose={() => setConnecting(false)}
          onOpenIntegration={(id) => router.push(accountHref({ id }))}
          owner={{}}
        />
      )}
    </SettingsPanel>
  );
}
