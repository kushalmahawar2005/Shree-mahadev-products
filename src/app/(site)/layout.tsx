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
  DEFAULT_OG_IMAGE,
} from "@/lib/utils/seo";
import { MotionRoot } from "@/components/motion/MotionRoot";
import "../globals.css";

/** Clean geometric sans (close to Cowberry's look). Mukta covers Devanagari. */
const figtree = Figtree({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

/** Hindi accents (product + category names): elegant Devanagari serif. */
// Hindi fonts: Devanagari only (Latin text uses Figtree), no italic (never used), and not preloaded,
// so they don't compete with the hero image / main font on first load (they swap in when ready).
const tiroHindi = Tiro_Devanagari_Hindi({
  weight: ["400"],
  style: ["normal"],
  subsets: ["devanagari"],
  variable: "--font-hindi",
  display: "swap",
  preload: false,
});

const mukta = Mukta({
  weight: ["400", "500", "600", "700"],
  subsets: ["devanagari"],
  variable: "--font-mukta",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Wood-pressed kachi ghani oils from Rajasthan`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  // No site-wide canonical: it made every page without its own (login, account, checkout…) point at
  // the home page. Pages set their own via pageMetadata; the home page sets "/".

  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: site.name,
    title: `${site.name} | Wood-pressed kachi ghani oils`,
    description: site.description,
    url: "/",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: site.name }],
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] },
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
        {/* Reveal "before" states need this class before the first paint (see PageReady). */}
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
        <MotionRoot>
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
        </MotionRoot>
      </body>
    </html>
  );
}
