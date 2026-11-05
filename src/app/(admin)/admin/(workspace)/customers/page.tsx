import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, IndianRupee, Repeat, UserPlus, Users } from "lucide-react";
import { CustomersToolbar } from "@/components/admin/CustomersToolbar";
import { StatTile } from "@/components/admin/ui";
import { Skeleton } from "@/components/shadcn/skeleton";
import {
  CUSTOMER_FILTERS,
  CUSTOMER_LTV_THRESHOLD,
  customerStats,
  listCustomers,
  type CustomerFilter,
} from "@/lib/server/customers";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Customers" };

const FILTER_LABEL: Record<CustomerFilter, string> = {
  all: "All",
  repeat: "Repeat buyers",
  one_time: "One-time",
  high_value: `High value (${formatMoney(CUSTOMER_LTV_THRESHOLD)}+)`,
  inactive_90d: "Inactive 90 days",
  cod_only: "COD only",
  rto: "RTO history",
};

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const date = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(d).replace(" ", "T") + "+05:30")) : "No orders";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-ink-muted">Everyone who has ordered or signed in, with their order history and lifetime value.</p>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <CustomersList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CustomersList({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const str = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");
  const filter = CUSTOMER_FILTERS.includes(str("f") as CustomerFilter) ? (str("f") as CustomerFilter) : "all";
  const q = str("q").trim().slice(0, 80);
  const page = Math.max(1, Math.floor(Number(str("page")) || 1));
  const data = await Promise.all([listCustomers({ q, filter, page }), customerStats()]).catch(
    (error) => (console.error("Could not load customers", error), null),
  );
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  const [result, stats] = data;

  const pages = Math.max(1, Math.ceil(result.total / result.perPage));
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter !== "all") params.set("f", filter);
  const href = (n: number) => {
    const p = new URLSearchParams(params);
    if (n > 1) p.set("page", String(n));
    return `/admin/customers${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={Users} label="Customers" value={stats.total.toLocaleString("en-IN")} note={`${stats.buyers} have ordered`} />
        <StatTile icon={Repeat} label="Repeat buyers" value={String(stats.repeat)} note={stats.buyers ? `${Math.round((stats.repeat / stats.buyers) * 100)}% of buyers` : "No buyers yet"} />
        <StatTile icon={IndianRupee} label="Lifetime revenue" value={formatMoney(stats.revenue)} note={stats.buyers ? `${formatMoney(Math.round(stats.revenue / stats.buyers))} per buyer` : "From placed orders"} />
        <StatTile icon={UserPlus} label="New (30 days)" value={String(stats.new30d)} note="Joined this month" />
      </section>

      <CustomersToolbar
        q={q}
        filter={filter}
        filters={CUSTOMER_FILTERS.map((id) => ({ id, label: FILTER_LABEL[id] }))}
        exportHref={`/admin/customers/export${params.size ? `?${params}` : ""}`}
      />

      {!result.customers.length ? (
        <p className={cn(card, "px-5 py-10 text-center text-sm text-ink-muted")}>No customers match these filters.</p>
      ) : (
        <>
          {/* Desktop */}
          <div className={cn(card, "hidden overflow-hidden lg:block")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Lifetime value</th>
                  <th className="px-4 py-3 font-medium">Last order</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Flags</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.customers.map((c) => (
                  <tr key={c.id} className="relative border-b border-line last:border-0 hover:bg-subtle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <Link
                            href={`/admin/customers/view?id=${c.id}`}
                            className="font-semibold text-ink after:absolute after:inset-0 hover:text-forest-fg"
                          >
                            {c.name}
                          </Link>
                          <p className="truncate text-xs text-ink-muted tabular-nums">
                            +91 {c.phone}
                            {c.email && ` · ${c.email}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : "-"}</td>
                    <td className="px-4 py-3 text-right text-ink tabular-nums">{c.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">{formatMoney(c.ltv)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{date(c.lastOrder)}</td>
                    <td className="px-4 py-3">
                      <Flags c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="space-y-2.5 lg:hidden">
            {result.customers.map((c) => (
              <li key={c.id} className={cn(card, "relative p-4")}>
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/customers/view?id=${c.id}`} className="block truncate font-semibold text-ink after:absolute after:inset-0">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-ink-muted tabular-nums">
                      +91 {c.phone}
                      {c.city && ` · ${c.city}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink tabular-nums">{formatMoney(c.ltv)}</p>
                    <p className="text-xs text-ink-muted">
                      {c.orders} order{c.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {(c.codOnly || c.rtoCount > 0) && (
                  <div className="mt-3">
                    <Flags c={c} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Customer pagination">
        <span className="text-ink-muted">
          {result.total} customer{result.total === 1 ? "" : "s"}
          {pages > 1 && ` · page ${result.page} of ${pages}`}
        </span>
        {pages > 1 && (
          <div className="flex gap-2">
            <PageLink href={href(result.page - 1)} disabled={result.page <= 1} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageLink>
            <PageLink href={href(result.page + 1)} disabled={result.page >= pages} label="Next page">
              <ChevronRight className="size-4" />
            </PageLink>
          </div>
        )}
      </nav>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-khaki-soft text-xs font-bold text-forest-fg" aria-hidden>
      {initials(name)}
    </span>
  );
}

function Flags({ c }: { c: { codOnly: boolean; rtoCount: number; orders: number } }) {
  return (
    <span className="relative z-10 flex flex-wrap gap-1.5">
      {c.orders >= 2 && <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest-fg">Repeat</span>}
      {c.codOnly && <span className="rounded-full bg-warm-strong px-2 py-0.5 text-[11px] font-semibold text-sale">COD only</span>}
      {c.rtoCount > 0 && (
        <span className="rounded-full bg-alert-soft px-2 py-0.5 text-[11px] font-semibold text-alert">
          {c.rtoCount} RTO
        </span>
      )}
    </span>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "grid size-9 place-items-center rounded-full border border-line bg-surface";
  return disabled ? (
    <span className={cn(cls, "text-ink-muted/40")} aria-hidden>
      {children}
    </span>
  ) : (
    <Link href={href} aria-label={label} className={cn(cls, "text-forest-fg hover:bg-khaki-soft")}>
      {children}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading customers">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-full bg-surface" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
export const instant = false;
