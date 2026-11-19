import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactElement, ReactNode } from "react";
import { type RenderOptions, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import baseMessages from "../../../i18n/messages/cs.json";
import { AppearanceProvider } from "../../../state/appearance";

type Tree = { [k: string]: unknown };

function merge(target: Tree, source: Tree): Tree {
  for (const [k, v] of Object.entries(source)) {
    const cur = target[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      target[k] = merge(cur && typeof cur === "object" ? { ...(cur as Tree) } : {}, v as Tree);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/** The cs catalog plus any not-yet-merged `i18n/messages/pending/settings*.cs.json` keys. */
function withPending(base: Tree): Tree {
  let out = { ...base };
  for (const name of ["settings.cs.json", "settings-2.cs.json"]) {
    try {
      const file = path.join(__dirname, "../../../i18n/messages/pending", name);
      out = merge(out, JSON.parse(readFileSync(file, "utf8")) as Tree);
    } catch {
      /* pending file gone once merged — the catalog already has the keys */
    }
  }
  return out;
}

export const settingsMessages = withPending(baseMessages as Tree);

/** `renderWithProviders` for settings tests: same providers, catalog + pending settings keys. */
export function renderSettings(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <AppearanceProvider>
        <NextIntlClientProvider locale="cs" messages={settingsMessages as never}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </NextIntlClientProvider>
      </AppearanceProvider>
    );
  }
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
