"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, SettingsPanel, Stack, Typography } from "@zibby/design-system";
import { ConnectedServicesList } from "../../connected-services/components/ConnectedServicesList";
import { accountHref } from "../../integrations/accountHref";
import { AccountCards } from "../../integrations/components/AccountCards";
import { ConnectWizardSheet } from "../../integrations/components/ConnectWizardSheet";
import { usePersonalIntegrationsQuery } from "../../integrations";

export enum AccountsSectionTestId {
  Connect = "settings-accounts-connect",
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
          <Typography type="h3">{t("servicesTitle")}</Typography>
          <Typography size="xs" type="note" variant="tertiary">
            {t("servicesHint")}
          </Typography>
          <ConnectedServicesList rowKeyPrefix="settings-accounts" />
        </Stack>
      </Stack>

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
