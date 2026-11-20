import { RoleGate } from "@/components/admin/RoleGate";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AlertTriangle, ImageOff, IndianRupee, Package, PackageCheck, Plus, Receipt } from "lucide-react";
import { ImportCatalogButton } from "@/components/admin/ImportCatalogButton";
import { ProductsTable, type ProductRow } from "@/components/admin/ProductsTable";
import { ProductsToolbar } from "@/components/admin/products/ProductsToolbar";
import { Skeleton } from "@/components/shadcn/skeleton";
import { loadCollections, loadProducts } from "@/lib/server/catalog";
import { getStoreSettings } from "@/lib/server/store-settings";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Products" };

const PER_PAGE = 25;
const STATUSES = ["all", "active", "draft", "archived"] as const;
const CATEGORIES = ["all", "oil", "honey", "sweetener"] as const;
const ISSUES = ["photo", "price", "tax", "stock"] as const;
type Issue = (typeof ISSUES)[number];

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-forest-text">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">One product per oil or honey. Sizes are variants with their own price and stock.</p>
        </div>
        <Link href="/admin/products/edit" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid">
          <Plus className="size-4" /> Add product
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
    </RoleGate>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-surface" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-full bg-surface" />
      <Skeleton className="h-[480px] rounded-2xl bg-surface" />
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const pick = <T extends readonly string[]>(list: T, v: string, fallback: T[number]) => (list.includes(v) ? v : fallback) as T[number];
  const status = pick(STATUSES, str("status"), "all");
  const category = pick(CATEGORIES, str("category"), "all");
  const issue = (ISSUES as readonly string[]).includes(str("issue")) ? (str("issue") as Issue) : null;
  const q = str("q").trim().toLowerCase().slice(0, 60);
  const page = Math.max(Number(str("page")) || 1, 1);

  const data = await Promise.all([loadProducts({ status: "any" }), loadCollections(), getStoreSettings()]).catch((e) => (console.error(e), null));
  if (!data) return <p className={cn(card, "p-6 text-sale")}>Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [all, collections, settings] = data;
  if (!all.length) return <ImportCatalogButton />;

  const low = settings.lowStockThreshold;
  const issuesOf = (p: (typeof all)[number]) => ({
    photo: p.images.every((i) => i.url.startsWith("/images/placeholder-")),
    price: p.variants.some((v) => v.enabled && !v.price.amount),
    tax: !p.hsn || p.gstRate == null,
    stock: p.variants.some((v) => v.stock !== null && v.stock <= low),
  });
  const counts = Object.fromEntries(ISSUES.map((k) => [k, all.filter((p) => issuesOf(p)[k]).length])) as Record<Issue, number>;
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, s === "all" ? all.length : all.filter((p) => p.status === s).length])) as Record<(typeof STATUSES)[number], number>;

  const filtered = all.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (category === "all" || p.category === category) &&
      (!issue || issuesOf(p)[issue]) &&
      (!q || `${p.title} ${p.titleHi} ${p.handle} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q)),
  );
  const pages = Math.max(Math.ceil(filtered.length / PER_PAGE), 1);
  const rows: ProductRow[] = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((p) => {
    const tracked = p.variants.filter((v) => v.stock !== null);
    const issues = issuesOf(p);
    return {
      handle: p.handle,
      title: p.title,
      titleHi: p.titleHi,
      image: p.images[0]?.url ?? "",
      hasPhoto: !issues.photo,
      swatch: p.swatch ?? null,
      category: p.category,
      status: p.status,
      sizes: p.variants.map((v) => ({ title: v.title, enabled: v.enabled, stock: v.stock })),
      from: p.priceRange.min.amount,
      to: p.priceRange.max.amount,
      stock: tracked.length ? tracked.reduce((s, v) => s + (v.stock ?? 0), 0) : null,
      lowSizes: p.variants.filter((v) => v.stock !== null && v.stock <= low).length,
      missingPrice: issues.price,
      missingTax: issues.tax,
    };
  });
  const base = { status, category, ...(issue ? { issue } : {}), ...(q ? { q } : {}) };
  const link = (o: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...o })) if (v !== null && v !== "" && v !== "all") params.set(k, String(v));
    const s = params.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  const active = all.filter((p) => p.status === "active");
  const prices = active.flatMap((p) => p.variants.filter((v) => v.enabled && v.price.amount).map((v) => v.price.amount));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Catalog summary">
        <Stat icon={Package} label="Live on store" value={`${active.length}`} note={`of ${all.length} products`} />
        <Stat icon={PackageCheck} label="Sizes on sale" value={`${active.reduce((s, p) => s + p.variants.filter((v) => v.enabled).length, 0)}`} note="across live products" />
        <Stat icon={IndianRupee} label="Price range" value={prices.length ? `₹${Math.min(...prices).toLocaleString("en-IN")}–${Math.max(...prices).toLocaleString("en-IN")}` : "—"} note="live sizes" />
        <Stat icon={AlertTriangle} label="Need attention" value={`${new Set(all.filter((p) => Object.values(issuesOf(p)).some(Boolean)).map((p) => p.handle)).size}`} note="see filters below" tone={counts.photo + counts.price + counts.tax + counts.stock ? "warn" : undefined} />
      </section>

      {(counts.photo > 0 || counts.price > 0 || counts.tax > 0 || counts.stock > 0) && (
        <div className="flex flex-wrap gap-2" aria-label="Quick fixes">
          {(
            [
              ["photo", ImageOff, "No photos"],
              ["price", IndianRupee, "Missing price"],
              ["tax", Receipt, "Missing HSN / GST"],
              ["stock", AlertTriangle, `Low stock (≤${low})`],
            ] as const
          )
            .filter(([k]) => counts[k] > 0)
            .map(([k, Icon, text]) => (
              <Link
                key={k}
                href={link({ issue: issue === k ? null : k, page: null })}
                scroll={false}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold ring-1 transition-colors",
                  issue === k ? "bg-mustard text-forest-deep ring-mustard" : "bg-warm text-ink ring-warm-line hover:ring-mustard/70",
                )}
              >
                <Icon className="size-3.5" /> {text}
                <span className={cn("rounded-full px-1.5 text-[11px]", issue === k ? "bg-forest-deep/15" : "bg-warm-strong text-sale")}>{counts[k]}</span>
              </Link>
            ))}
        </div>
      )}

      <ProductsToolbar
        status={status}
        category={category}
        q={q}
        statusCounts={statusCounts}
        statusLinks={Object.fromEntries(STATUSES.map((s) => [s, link({ status: s, page: null })]))}
        categoryLinks={Object.fromEntries(CATEGORIES.map((c) => [c, link({ category: c, page: null })]))}
      />

      {rows.length ? (
        <ProductsTable rows={rows} collections={collections.map((c) => ({ handle: c.handle, title: c.title }))} />
      ) : (
        <div className={cn(card, "px-6 py-14 text-center")}>
          <Package className="mx-auto size-8 text-ink-muted" />
          <p className="mt-3 font-semibold text-forest-text">No products match</p>
          <p className="mt-1 text-sm text-ink-muted">Try another search or clear the filters.</p>
          <Link href="/admin/products" className="mt-4 inline-flex h-9 items-center rounded-full border border-line px-4 text-sm font-semibold text-forest-text hover:border-forest">
            Clear filters
          </Link>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-ink-muted">
            Page {page} of {pages} · {filtered.length} products
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link href={link({ page: page - 1 })} className="inline-flex h-9 items-center rounded-full border border-line px-4 font-semibold text-forest-text hover:border-forest">Previous</Link>}
            {page < pages && <Link href={link({ page: page + 1 })} className="inline-flex h-9 items-center rounded-full border border-line px-4 font-semibold text-forest-text hover:border-forest">Next</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, note, tone }: { icon: typeof Package; label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className={cn(card, "flex items-center gap-3 p-4", tone === "warn" && "border-warm-line")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "warn" ? "bg-warm-strong text-sale" : "bg-khaki-soft text-forest-fg")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate text-xl font-bold tracking-tight text-forest-text">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

export const instant = false;
