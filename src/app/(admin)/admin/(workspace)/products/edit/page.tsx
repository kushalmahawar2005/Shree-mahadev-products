import { connection } from "next/server";
import { Suspense } from "react";
import { ProductImageManager } from "@/components/admin/media/ProductImageManager";
import { ProductVideoManager } from "@/components/admin/media/ProductVideoManager";
import { listReels } from "@/lib/server/videos";
import { ProductForm } from "@/components/admin/ProductForm";
import { loadCollections, loadProducts, type ProductInput } from "@/lib/server/catalog";
import { getProductImages } from "@/lib/server/media";

export const metadata = { title: "Edit product" };

export default function EditProductPage({ searchParams }: PageProps<"/admin/products/edit">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

const EMPTY: ProductInput = {
  handle: "",
  title: "",
  titleHi: "",
  category: "oil",
  shortDescription: "",
  descriptionHtml: "",
  benefits: [],
  bestFor: [],
  tags: [],
  faqs: [],
  status: "draft",
  hsn: undefined,
  gstRate: undefined,
  collections: [],
  variants: [{ title: "1 L", sizeValue: 1000, sizeUnit: "ml", price: 0, stock: null, available: true }],
};

async function Editor({ searchParams }: { searchParams: PageProps<"/admin/products/edit">["searchParams"] }) {
  await connection();
  const h = (await searchParams).handle;
  const handle = typeof h === "string" ? h : "";
  const data = await Promise.all([handle ? loadProducts({ handles: [handle] }) : Promise.resolve([]), loadCollections()]).catch(
    (e) => (console.error(e), null),
  );
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [[p], collections] = data;
  if (handle && !p) return <p className="text-sale">Product not found.</p>;

  const initial: ProductInput = p
    ? {
        handle: p.handle,
        title: p.title,
        titleHi: p.titleHi,
        category: p.category,
        swatch: p.swatch,
        shortDescription: p.shortDescription,
        descriptionHtml: p.descriptionHtml,
        benefits: p.benefits,
        bestFor: p.bestFor,
        howToUse: p.howToUse,
        processNote: p.processNote,
        labReportUrl: p.labReportUrl,
        shelfLife: p.shelfLife,
        tags: p.tags,
        faqs: p.faqs ?? [],
        seoTitle: p.seo.title === p.title ? undefined : p.seo.title,
        seoDescription: p.seo.description === p.shortDescription ? undefined : p.seo.description,
        hsn: p.hsn ?? undefined,
        gstRate: p.gstRate ?? undefined,
        status: p.status,
        collections: p.collections,
        defaultSize: p.defaultSize,
        variants: p.variants.map((v) => ({
          key: v.id,
          title: v.title,
          sizeValue: v.sizeValue,
          sizeUnit: v.sizeUnit,
          price: v.price.amount,
          compareAtPrice: v.compareAtPrice?.amount,
          stock: v.stock,
          available: v.enabled,
          sku: v.sku,
          weightGrams: v.weightGrams ?? undefined,
        })),
      }
    : EMPTY;
  const [images, reels] = p ? await Promise.all([getProductImages(p.handle), listReels()]) : [[], []];

  return (
    <>
      <ProductForm
        key={p?.handle ?? "new"}
        initial={initial}
        isNew={!p}
        collections={collections.map((c) => ({ handle: c.handle, title: c.title }))}
        photos={p ? <ProductImageManager handle={p.handle} title={p.title} initial={images} compact /> : undefined}
        videos={p ? <ProductVideoManager handle={p.handle} initial={reels} /> : undefined}
      />
    </>
  );
}
export const instant = false;
