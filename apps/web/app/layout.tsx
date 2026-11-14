import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeScript, htmlFontAttrs } from "@zibby/design-system";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import { PropsWithChildren } from "react";

// Bridge redesign — Geist (UI) + Geist Mono (ids, times, branches). Variable fonts,
// self-hosted by next/font at build time (no runtime network).
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZibbyOS",
  description: "ZibbyOS — Zestful Intuitive Brainy Butler for You.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      suppressHydrationWarning
      {...htmlFontAttrs(geist.variable, geistMono.variable)}
      lang={locale}
    >
      <head>
        {/* Sets <html data-theme> before hydration — see ThemeScript's doc comment
         * and DesignSystemProvider (providers.tsx) for the post-hydration half.
         * `fallback="light"` (ZB-01/O-01/D-014) matches `Providers`' own
         * `theme="system"` default now that light — not dark — is the app's
         * default theme. */}
        <ThemeScript densityFallback="airy" fallback="light" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
