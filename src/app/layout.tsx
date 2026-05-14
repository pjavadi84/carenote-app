import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { OrganizationJsonLd } from "@/components/seo/organization-jsonld";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kinroster.com";
const SITE_NAME = "Kinroster";
const SITE_DESCRIPTION =
  "AI-powered documentation for residential care homes. Transform caregiver observations into structured shift logs, incident reports, and family updates.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Default to indexable; pages that should be hidden (auth, dashboard,
  // portal) override this in their own metadata or are blocked at the
  // robots.ts level.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Search Console verification token. Set in Vercel as
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION before adding the property in
  // GSC; until then this is undefined and the meta tag is omitted.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  // OG and apple-touch-icon images are emitted by the file conventions
  // at src/app/opengraph-image.tsx and src/app/apple-icon.tsx.
  // src/app/favicon.ico covers the standard favicon. No manual `icons`
  // or `openGraph.images` entries needed — Next would duplicate tags.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow user-scaling. Disabling pinch-zoom is an accessibility
  // anti-pattern flagged by Lighthouse and WCAG 2.1 SC 1.4.4.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground antialiased">
        <OrganizationJsonLd />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
