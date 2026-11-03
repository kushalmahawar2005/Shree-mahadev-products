import type { Metadata } from "next";
import { Figtree, Mukta } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { NotFoundContent } from "@/components/content/NotFoundContent";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomBar } from "@/components/layout/MobileBottomBar";
import { SiteCartDrawer, SiteHeader } from "@/components/layout/SiteChrome";
import "./globals.css";

// The app has two root layouts (store + admin), so unmatched URLs need their own full page.
const figtree = Figtree({ weight: ["400", "500", "600", "700", "800"], subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const mukta = Mukta({ weight: ["400", "500", "600", "700"], subsets: ["latin", "devanagari"], variable: "--font-mukta", display: "swap" });

export const metadata: Metadata = { title: "Page not found | Swadeshi Mahadev Products", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${mukta.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <CartProvider>
          <SiteHeader />
          <main id="main" className="flex-1">
            <NotFoundContent />
          </main>
          <Footer />
          <MobileBottomBar />
          <SiteCartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
