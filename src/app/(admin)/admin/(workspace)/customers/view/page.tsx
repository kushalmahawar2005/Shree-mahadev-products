import { RoleGate } from "@/components/admin/RoleGate";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowLeft, CalendarClock, IndianRupee, MapPin, NotebookPen, Package, ShieldAlert, ShieldCheck, ShoppingBag } from "lucide-react";
import { CustomerDetailsForm } from "@/components/admin/CustomerDetailsForm";
import { CustomerPhone } from "@/components/admin/CustomerPhone";
import { ORDER_LABEL } from "@/components/admin/orderLabels";
import { StatTile, StatusBadge } from "@/components/admin/ui";
import { Skeleton } from "@/components/shadcn/skeleton";
import { getCustomerById } from "@/lib/server/customers";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Customer" };

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const date = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(d).replace(" ", "T") + "+05:30"));
const payLabel = (m: string) => (m === "cod" ? "COD" : m === "offline" ? "Offline paid" : "Online");

export default function CustomerViewPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <Suspense fallback={<DetailSkeleton />}>
      <CustomerDetail searchParams={searchParams} />
    </Suspense>
    </RoleGate>
  );
}

function Back() {
  return (
    <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-forest-fg">
      <ArrowLeft className="size-4" />
      All customers
    </Link>
  );
}

async function CustomerDetail({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  await connection();
  const id = Number((await searchParams).id);
  const customer =
    Number.isInteger(id) && id > 0 ? await getCustomerById(id).catch((error) => (console.error("Could not load customer", error), null)) : null;

  if (!customer)
    return (
      <div className="space-y-4">
        <Back />
        <div className={cn(card, "px-6 py-12 text-center")}>
          <h1 className="text-xl font-bold text-forest-text">Customer not found</h1>
          <p className="mt-1 text-sm text-ink-muted">This customer may have been removed, or the database is unavailable.</p>
        </div>
      </div>
    );

  // Same address saved by several orders: show it once (newest first already).
  const addresses = customer.addresses.filter(
    (a, i, all) => all.findIndex((b) => `${b.name}|${b.line1}|${b.line2}|${b.pincode}`.toLowerCase() === `${a.name}|${a.line1}|${a.line2}|${a.pincode}`.toLowerCase()) === i,
  );
  const initials = customer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Back />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-khaki-soft text-lg font-bold text-forest-fg">{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">{customer.name}</h1>
              {customer.orderCount >= 2 && <StatusBadge tone="green">Repeat buyer</StatusBadge>}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              Customer since {date(customer.createdAt)}
              {customer.email && ` · ${customer.email}`}
            </p>
          </div>
        </div>
        <CustomerPhone phone={customer.phone} email={customer.email || undefined} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={ShoppingBag} label="Placed orders" value={String(customer.orderCount)} note={`${customer.orders.length} incl. unpaid / cancelled`} />
        <StatTile icon={IndianRupee} label="Lifetime value" value={formatMoney(customer.ltv)} note={customer.orderCount ? `${formatMoney(Math.round(customer.ltv / customer.orderCount))} avg order` : "No placed orders"} />
        <StatTile icon={CalendarClock} label="Last order" value={customer.lastOrder ? date(customer.lastOrder) : "-"} />
        <StatTile
          icon={customer.rtoCount ? ShieldAlert : ShieldCheck}
          label="RTO history"
          value={customer.rtoCount ? `${customer.rtoCount} RTO${customer.rtoCount === 1 ? "" : "s"}` : "None"}
          note={customer.rtoCount ? "Confirm before COD" : "Safe for COD"}
          tone={customer.rtoCount ? "warn" : undefined}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] xl:items-start">
        <div className="space-y-4">
          <Panel icon={Package} title="Orders" hint={`${customer.orders.length} total`}>
            {!customer.orders.length ? (
              <p className="text-sm text-ink-muted">No orders recorded.</p>
            ) : (
              <ul className="-mx-4 divide-y divide-line sm:-mx-5">
                {customer.orders.map((o) => {
                  const label = ORDER_LABEL[o.status as keyof typeof ORDER_LABEL];
                  return (
                    <li key={o.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-subtle sm:px-5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/orders/view?id=${o.id}`} className="font-semibold text-ink after:absolute after:inset-0 hover:text-forest-fg">
                          {o.orderNo}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {date(o.createdAt)} · {payLabel(o.paymentMethod)}
                        </p>
                      </div>
                      <StatusBadge tone={label?.tone ?? "gray"}>{label?.text ?? o.status}</StatusBadge>
                      <span className="w-20 text-right font-semibold text-ink tabular-nums">{formatMoney(o.total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel icon={NotebookPen} title="Notes and tags" hint="Only visible to your team">
            <CustomerDetailsForm customerId={customer.id} initialNotes={customer.notes} initialTags={customer.tags} />
          </Panel>
        </div>

        <div className="xl:sticky xl:top-20">
          <Panel icon={MapPin} title="Addresses" hint={`${addresses.length} saved`}>
            {!addresses.length ? (
              <p className="text-sm text-ink-muted">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {addresses.map((a, i) => (
                  <li key={`${a.pincode}-${i}`} className="rounded-xl border border-line bg-subtle p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{a.name}</p>
                      {i === 0 && <span className="rounded-full bg-khaki-soft px-2 py-0.5 text-[11px] font-semibold text-forest-fg">Latest</span>}
                    </div>
                    <p className="text-xs text-ink-muted tabular-nums">+91 {a.phone}</p>
                    <address className="mt-1.5 text-sm leading-relaxed text-ink-muted not-italic">
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}
                      <br />
                      {a.city}, {a.state} {a.pincode}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, hint, children }: { icon: typeof Package; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={cn(card, "p-4 sm:p-5")}>
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-bold text-forest-text">{title}</h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading customer">
      <Skeleton className="h-16 w-72 rounded-2xl bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl bg-surface" />
    </div>
  );
}
export const instant = false;
