import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, ChevronRight, FlaskConical, Truck } from "lucide-react";
import { ShopListing } from "@/components/product/ShopListing";
import { getProducts } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/server/store-settings";
import { formatMoney } from "@/lib/utils/money";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shop all products",
  description: "Wood-pressed kachi ghani oils, raw honey and natural sweeteners from Bijainagar, Rajasthan.",
  path: "/shop",
});

export default async function ShopPage() {
  const [products, settings] = await Promise.all([getProducts(), getStoreSettings()]);
  return (
    <div className="paper-grain relative overflow-hidden bg-[#F5EDDE]">
      <div className="relative mx-auto max-w-[1360px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
        {/* Hero band */}
        <section className="relative overflow-hidden rounded-[32px] bg-forest px-6 py-8 text-white md:px-12 md:py-12">
          <span aria-hidden className="absolute -top-24 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgba(180,144,36,0.5),transparent_65%)]" />
          <span aria-hidden className="absolute -bottom-32 left-1/3 size-80 rounded-full bg-[radial-gradient(circle,rgba(232,200,121,0.18),transparent_65%)]" />
          <nav aria-label="Breadcrumb" className="relative flex items-center gap-1 text-xs text-white/60">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-white/90">Shop all</span>
          </nav>
          <p className="font-hindi relative mt-4 text-lg text-[#e8c879]" lang="hi">
            धीमी घानी, सच्चा स्वाद
          </p>
          <h1 className="relative text-4xl text-white md:text-6xl">Shop all</h1>
          <p className="relative mt-2 max-w-xl text-white/75 md:text-lg">Oils, honey and sweeteners, made slowly in Bijainagar. {products.length} products, all from our own ghani.</p>
          <ul className="relative mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
              <Truck className="size-3.5 text-[#e8c879]" /> Free shipping over {formatMoney(settings.shipping.freeShippingThreshold)}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
              <FlaskConical className="size-3.5 text-[#e8c879]" /> Lab tested
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
              <BadgeCheck className="size-3.5 text-[#e8c879]" /> FSSAI licensed
            </li>
          </ul>
        </section>

        <Suspense fallback={<div className="mt-10 h-96" />}>
          <ShopListing products={products} />
        </Suspense>
      </div>
    </div>
  );
}
