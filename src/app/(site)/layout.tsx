import type { Metadata, Viewport } from "next";
import { Figtree, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { StoreSettingsProvider } from "@/components/StoreSettingsProvider";
import { getStoreSettings } from "@/lib/server/store-settings";
import { getPublicLeadPopup } from "@/lib/server/leads";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { SiteCartDrawer, SiteHeader } from "@/components/layout/SiteChrome";
import { ConsentManager } from "@/components/marketing/ConsentManager";
import { WelcomeOffer } from "@/components/marketing/WelcomeOffer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { site } from "@/data/site";
import {
  jsonLdString,
  localBusinessJsonLd,
  organizationJsonLd,
} from "@/lib/utils/seo";
import "../globals.css";

/** Clean geometric sans (close to Cowberry's look). Mukta covers Devanagari. */
const figtree = Figtree({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

/** Hindi accents (product + category names): elegant Devanagari serif. */
const tiroHindi = Tiro_Devanagari_Hindi({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["devanagari", "latin"],
  variable: "--font-hindi",
  display: "swap",
});

const mukta = Mukta({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
  variable: "--font-mukta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Wood-pressed kachi ghani oils from Rajasthan`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: "/" },

  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: `${site.name} | Wood-pressed kachi ghani oils`,
    description: site.description,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#D0B17A",
  colorScheme: "only light",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${mukta.variable} ${tiroHindi.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[60] rounded-full bg-forest px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString([organizationJsonLd(), localBusinessJsonLd()]),
          }}
        />
        <StoreSettingsProvider value={await getStoreSettings()}>
          <CartProvider>
            <SmoothScroll>
              <SiteHeader />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
              <MobileBottomBar />
              <SiteCartDrawer />
              <ConsentManager />
              <WelcomeOffer config={await getPublicLeadPopup()} />
            </SmoothScroll>
          </CartProvider>
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
