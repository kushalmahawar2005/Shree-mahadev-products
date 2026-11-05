import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopListing } from "@/components/product/ShopListing";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { getProducts } from "@/lib/commerce";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shop all products",
  description: "Wood-pressed kachi ghani oils, raw honey and natural sweeteners from Bijainagar, Rajasthan.",
  path: "/shop",
});

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
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
            <p className="mt-1 text-sm text-ink-muted">Oils, honey and sweeteners, made slowly in Bijainagar.</p>
          </div>
        </div>
        <Suspense fallback={<div className="mt-10 h-96" />}>
          <ShopListing products={products} />
        </Suspense>
      </div>
    </div>
  );
}
