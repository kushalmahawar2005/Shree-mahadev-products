import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ImportCatalogButton } from "@/components/admin/ImportCatalogButton";
import { ProductsTable, type ProductRow } from "@/components/admin/ProductsTable";
import { PageHeader } from "@/components/admin/ui";
import { loadCollections, loadProducts, type ProductStatus } from "@/lib/server/catalog";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Products" };

const PER_PAGE = 25;
const FILTERS: { id: ProductStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
];

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <>
      <PageHeader
        title="Products"
        intro="One product = one oil/honey. Sizes are variants. Select rows for bulk actions."
        action={
          <Link href="/admin/products/edit" className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 font-semibold text-white hover:bg-forest-mid">
            + Add product
          </Link>
        }
      />
      <Suspense fallback={<p className="text-ink-muted">Loading products…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = (FILTERS.some((f) => f.id === str("status")) ? str("status") : "all") as ProductStatus | "all";
  const q = str("q").trim().toLowerCase().slice(0, 60);
  const page = Math.max(Number(str("page")) || 1, 1);

  const data = await Promise.all([loadProducts({ status: "any" }), loadCollections()]).catch((e) => (console.error(e), null));
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [all, collections] = data;
  if (!all.length) return <ImportCatalogButton />;

  const filtered = all.filter(
    (p) => (status === "all" || p.status === status) && (!q || `${p.title} ${p.titleHi} ${p.handle} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q)),
  );
  const pages = Math.max(Math.ceil(filtered.length / PER_PAGE), 1);
  const rows: ProductRow[] = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((p) => {
    const tracked = p.variants.filter((v) => v.stock !== null);
    return {
      handle: p.handle,
      title: p.title,
      titleHi: p.titleHi,
      image: p.images[0]?.url ?? "",
      category: p.category,
      status: p.status,
      variants: p.variants.length,
      from: p.priceRange.min.amount,
      stock: tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null,
      collections: p.collections,
    };
  });
  const link = (o: Record<string, string | number>) =>
    `/admin/products?${new URLSearchParams({ status, ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/products?status=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold",
              f.id === status ? "border-forest bg-forest text-white" : "border-line bg-white hover:border-forest/50",
            )}
          >
            {f.label} <span className="ml-1.5 opacity-70">{f.id === "all" ? all.length : all.filter((p) => p.status === f.id).length}</span>
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/products">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Name, handle or SKU" className="min-h-10 w-52 rounded-full border border-line px-4 text-sm" />
          <button className="min-h-10 rounded-full bg-forest px-4 text-sm font-semibold text-white">Search</button>
        </form>
      </div>
      {rows.length ? (
        <ProductsTable rows={rows} collections={collections.map((c) => ({ handle: c.handle, title: c.title }))} />
      ) : (
        <p className="text-ink-muted">No products match.</p>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-ink-muted">
            Page {page} of {pages} · {filtered.length} products
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link href={link({ page: page - 1 })} className="min-h-10 rounded-full border border-line px-4 leading-10">← Prev</Link>}
            {page < pages && <Link href={link({ page: page + 1 })} className="min-h-10 rounded-full border border-line px-4 leading-10">Next →</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
