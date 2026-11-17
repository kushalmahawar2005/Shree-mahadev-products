import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { AppBanner } from "@/components/pwa/AppBanner";
import { Figtree, Mukta, Tiro_Devanagari_Hindi } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { StoreSettingsProvider } from "@/components/StoreSettingsProvider";
import { getStoreSettings } from "@/lib/server/store-settings";
import { getPublicLeadPopup } from "@/lib/server/leads";
import { Footer } from "@/components/layout/Footer";
import { FestiveToran } from "@/components/layout/FestiveToran";
import { HideOnCheckout } from "@/components/layout/HideOnCheckout";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { SiteCartDrawer, SiteHeader } from "@/components/layout/SiteChrome";
import { ConsentManager } from "@/components/marketing/ConsentManager";
import { WelcomeOffer } from "@/components/marketing/WelcomeOffer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { LoadingBar } from "@/components/motion/LoadingBar";
import { PAGE_OPEN_SCRIPT, PageReady } from "@/components/motion/PageReady";
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
  // The Pinterest browser extension injects a "Save" button into product/hero images before React
  // hydrates, which caused a hydration mismatch (HeroCarousel). `nopin` is Pinterest's official opt-out:
  // the extension then leaves our images alone.
  other: { pinterest: "nopin" },
};

export const viewport: Viewport = {
  themeColor: "#D0B17A",
  colorScheme: "only light",
  // Android Chrome: the on-screen keyboard shrinks the layout viewport, so fixed sheets (chat) stay in view.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${mukta.variable} ${tiroHindi.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        {/* Page open: hide until hydrated (see PageReady); must run before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: PAGE_OPEN_SCRIPT }} />
        <PageReady />
        <PwaRegister />
        <LoadingBar />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString([organizationJsonLd(), localBusinessJsonLd()]),
          }}
        />
        <StoreSettingsProvider value={await getStoreSettings()}>
          <CartProvider>
            <SmoothScroll>
              <HideOnCheckout>
                <SiteHeader />
                <FestiveToran />
                <ChatWidget />
              </HideOnCheckout>
              <main id="main" className="flex-1">
                {children}
              </main>
              <HideOnCheckout>
                <AppBanner />
                <Footer />
                <MobileBottomBar />
              </HideOnCheckout>
              <SiteCartDrawer />
              <ConsentManager />
              <HideOnCheckout>
                <WelcomeOffer config={await getPublicLeadPopup()} />
              </HideOnCheckout>
            </SmoothScroll>
          </CartProvider>
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
