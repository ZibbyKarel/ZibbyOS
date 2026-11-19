import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { AppearanceProvider } from "../../../state/appearance";
import cs from "../../../i18n/messages/cs.json";

const messages = cs;

/** Renders with the real providers; a missing translation key fails the test. */
export function renderAutonomy(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Providers = ({ children }: { children: ReactNode }) => (
    <AppearanceProvider>
      <NextIntlClientProvider
        locale="cs"
        messages={messages}
        onError={(e) => {
          throw e;
        }}
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    </AppearanceProvider>
  );
  return render(ui, { wrapper: Providers });
}
