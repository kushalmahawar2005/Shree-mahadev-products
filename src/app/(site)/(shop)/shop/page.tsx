import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopListing } from "@/components/product/ShopListing";
import { Container } from "@/components/ui/primitives";
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
    <Container className="py-10 md:py-14">
      <h1 className="text-4xl md:text-5xl">Shop all</h1>
      <p className="mt-2 text-lg text-ink-muted">Oils, honey and sweeteners, made slowly in Bijainagar.</p>
      <Suspense fallback={<div className="mt-10 h-96" />}>
        <ShopListing products={products} />
      </Suspense>
    </Container>
  );
}
