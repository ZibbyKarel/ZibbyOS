import type { Route } from "next";

/** Where the operator's personal accounts are listed (Settings → Access → Accounts). */
export const PERSONAL_ACCOUNTS_HREF = "/system/settings/access#accounts" as Route;

/** The detail page of an account: under its company, or under settings for a personal one. */
export function accountHref(account: { id: string; companyId?: string | undefined }): Route {
  return (
    account.companyId
      ? `/companies/${account.companyId}/integrations/${account.id}`
      : `/system/settings/accounts/${account.id}`
  ) as Route;
}

/** Where the back link of an account's detail page goes. */
export function accountOwnerHref(account: { companyId?: string | undefined }): Route {
  return (
    account.companyId ? `/companies/${account.companyId}?tab=integrations` : PERSONAL_ACCOUNTS_HREF
  ) as Route;
}
