import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductImageManager } from "@/components/admin/media/ProductImageManager";
import { getProductImages } from "@/lib/server/media";
import { notFound } from "next/navigation";
import { Card, Field, MockSave, PageHeader, Table, inputCls } from "@/components/admin/ui";
import { mockStock } from "@/data/admin";
import { getProduct, getProducts } from "@/lib/commerce";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ handle: p.handle }));
}

export default async function EditProduct({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await getProduct(handle);
  if (!p) notFound();

  return (
    <>
      <PageHeader
        title={p.title}
        intro={p.titleHi}
        action={
          <Link href={`/products/${p.handle}`} target="_blank" className="text-forest underline">
            View on storefront ↗
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card title="Photos">
            <Suspense fallback={<p className="text-ink-muted">Loading photos…</p>}>
              <Photos handle={p.handle} title={p.title} />
            </Suspense>
          </Card>
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input className={inputCls} defaultValue={p.title} />
              </Field>
              <Field label="Hindi name">
                <input className={inputCls} defaultValue={p.titleHi} lang="hi" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Short description">
                  <input className={inputCls} defaultValue={p.shortDescription} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Benefits (one per line)">
                  <textarea className={`${inputCls} py-3`} rows={4} defaultValue={p.benefits.join("\n")} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Best for (one per line)">
                  <textarea className={`${inputCls} py-3`} rows={3} defaultValue={p.bestFor.join("\n")} />
                </Field>
              </div>
            </div>
          </Card>
          <Card title="Variants">
            <Table head={["Size", "Price", "MRP", "Stock", "Available"]}>
              {p.variants.map((v) => (
                <tr key={v.id}>
                  <td className="font-semibold">{v.title}</td>
                  <td>
                    <input className={`${inputCls} max-w-28`} defaultValue={v.price.amount} inputMode="numeric" />
                  </td>
                  <td>
                    <input className={`${inputCls} max-w-28`} defaultValue={v.compareAtPrice?.amount ?? ""} inputMode="numeric" />
                  </td>
                  <td>{mockStock(v.id)}</td>
                  <td>
                    <input type="checkbox" defaultChecked={v.availableForSale} className="size-5 accent-[var(--color-forest)]" />
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Lab report & shelf life">
            <div className="space-y-4">
              <Field label="Lab report PDF" hint="TODO(client): upload per-product lab report">
                <input className={inputCls} defaultValue={p.labReportUrl ?? ""} placeholder="Not uploaded" />
              </Field>
              <Field label="Shelf life">
                <input className={inputCls} defaultValue={p.shelfLife ?? ""} />
              </Field>
            </div>
          </Card>
          <Card title="SEO">
            <div className="space-y-4">
              <Field label="Page title">
                <input className={inputCls} defaultValue={p.seo.title} />
              </Field>
              <Field label="Meta description">
                <textarea className={`${inputCls} py-3`} rows={3} defaultValue={p.seo.description} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-6">
        <MockSave />
      </div>
    </>
  );
}

async function Photos({ handle, title }: { handle: string; title: string }) {
  await connection();
  const images = await getProductImages(handle).catch((e) => (console.error(e), null));
  if (!images) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  return <ProductImageManager handle={handle} title={title} initial={images} />;
}
