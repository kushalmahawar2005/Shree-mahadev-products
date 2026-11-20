import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopListing } from "@/components/product/ShopListing";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { toPickProduct } from "@/components/home/pickProduct";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { BelowGrid, CategoryPills, ChipRail, ItemListJsonLd, TrustRow, UseChips } from "@/components/product/ListingExtras";
import { getProducts } from "@/lib/commerce";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shop Wood-Pressed Oils, Raw Honey & Jaggery Online",
  description:
    "Shop all kachi ghani wood-pressed oils (mustard, groundnut, coconut, sesame, almond and more), raw honey and jaggery. Pressed in Rajasthan, delivered across India.",
  path: "/shop",
});

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-10 md:px-8 md:pt-8 md:pb-24">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Shop all</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl">Shop all</h1>
            <p className="mt-1 hidden text-sm text-ink-muted md:block">Oils, honey and sweeteners, made slowly in Bijainagar.</p>
          </div>
        </div>
        <TrustRow />
        <ChipRail>
          <CategoryPills current="shop" total={products.length} />
          <UseChips path="/shop" products={products} />
        </ChipRail>
        <ItemListJsonLd products={products} />
        <Suspense fallback={<div className="mt-10 h-96" />}>
          <ShopListing products={products} group />
        </Suspense>
        <BelowGrid handle="shop" title="Products" />
        <div className="-mx-6 md:-mx-8">
          <RecentlyViewed products={(await getProducts()).filter((p) => p.priceRange.min.amount > 0).map(toPickProduct)} />
        </div>
      </div>
    </div>
  );
}
