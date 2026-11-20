import type { Metadata } from "next";
import { Figtree, Mukta } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { StoreSettingsProvider } from "@/components/StoreSettingsProvider";
import { getStoreSettings } from "@/lib/server/store-settings";
import { NotFoundContent } from "@/components/content/NotFoundContent";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { SiteCartDrawer, SiteHeader } from "@/components/layout/SiteChrome";
import "./globals.css";

// The app has two root layouts (store + admin), so unmatched URLs need their own full page.
// Variable font: one file for all weights.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});
const mukta = Mukta({
  weight: ["400", "500", "600", "700"],
  subsets: ["devanagari"],
  variable: "--font-mukta",
  display: "swap",
  // Hindi accents only: never preload (Next shares font preloads across root layouts, so a preloaded
  // font here would be downloaded on every storefront page too).
  preload: false,
});

export const metadata: Metadata = {
  title: "Page not found | Swadeshi Mahadev Products",
  robots: { index: false },
};

export default async function GlobalNotFound() {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${mukta.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <StoreSettingsProvider value={await getStoreSettings()}>
          <CartProvider>
            <SiteHeader />
            <main id="main" className="flex-1">
              <NotFoundContent />
            </main>
            <Footer />
            <MobileBottomBar />
            <SiteCartDrawer />
          </CartProvider>
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
