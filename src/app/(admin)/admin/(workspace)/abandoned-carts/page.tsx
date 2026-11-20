import { RoleGate } from "@/components/admin/RoleGate";
import { connection } from "next/server";
import { Suspense } from "react";
import { AbandonedCartsWorkspace, type CartRow, type LeadRow } from "@/components/admin/AbandonedCartsWorkspace";
import { Skeleton } from "@/components/shadcn/skeleton";
import { ABANDON_AFTER_MIN, listAdminCarts, type AdminCart } from "@/lib/server/carts";
import { listCoupons } from "@/lib/server/coupons";
import { getLeadPopupConfig, listLeads, type AdminLead } from "@/lib/server/leads";

export const metadata = { title: "Abandoned carts" };

export default function AbandonedCartsPage() {
  return (
    <RoleGate roles={["owner", "manager"]}>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Abandoned carts &amp; leads</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Carts idle {ABANDON_AFTER_MIN}+ min without an order (last 30 days), and visitors who shared their number for the welcome offer.
        </p>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Data />
      </Suspense>
    </div>
    </RoleGate>
  );
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
/** Request time; page is dynamic (connection()) so this runs per request. */
const requestTime = () => Date.now();

function ago(ts: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(ts.replace(" ", "T") + "+05:30").getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

const wa = (phone: string, text: string) => `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;

function cartMessage(c: AdminCart) {
  const first = c.name?.split(" ")[0];
  const items = c.items.map((i) => `${i.title} (${i.variant})`).join(", ");
  return `Namaste${first ? ` ${first}` : ""}! You left ${items} in your cart at Swadeshi Mahadev Products. Complete your order here: ${SITE}/cart/recover/${c.token}\nNeed help? Just reply to this message.`;
}

function leadMessage(l: AdminLead) {
  const first = l.name.split(" ")[0];
  const code = l.couponCode ? ` Your welcome code ${l.couponCode} is waiting for you at checkout.` : "";
  return `Namaste ${first}! Thank you for visiting Swadeshi Mahadev Products.${code} Shop our wood-pressed oils here: ${SITE}\nAny questions? Just reply to this message.`;
}

async function Data() {
  await connection();
  const data = await Promise.all([listAdminCarts(), listLeads(), getLeadPopupConfig(), listCoupons()]).catch(
    (e) => (console.error(e), null),
  );
  if (!data) return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars (and run pnpm db:setup).</p>;
  const [carts, leads, popup, coupons] = data;
  const now = requestTime();

  const cartRows: CartRow[] = carts
    .filter((c) => c.status !== "converted")
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      pincode: c.pincode,
      subtotal: c.subtotal,
      status: c.status === "recovered" ? "recovered" : "abandoned",
      stage:
        c.orderStatus === "payment_failed" || c.orderStatus === "pending_payment"
          ? `Payment failed (${c.orderNo})`
          : c.reachedCheckout
            ? "Reached checkout"
            : "Added to cart",
      stageTone: c.orderStatus === "payment_failed" || c.orderStatus === "pending_payment" ? "alert" : c.reachedCheckout ? "warm" : "muted",
      linkOpened: !!c.linkOpenedAt,
      orderNo: c.orderNo,
      reminderCount: c.reminderCount,
      lastActive: ago(c.lastActivityAt, now),
      items: c.items.map((i) => ({ title: i.title, variant: i.variant, qty: i.qty })),
      waHref: c.phone && c.status === "abandoned" ? wa(c.phone, cartMessage(c)) : null,
    }));

  const leadRows: LeadRow[] = leads.map((l) => ({ ...l, captured: ago(l.createdAt, now), waHref: wa(l.phone, leadMessage(l)) }));

  const couponOptions = coupons
    .filter((c) => c.kind === "percent")
    .map((c) => ({ code: c.code, percent: c.value, active: c.active && (!c.endsAt || new Date(c.endsAt.replace(" ", "T") + ":00+05:30").getTime() > now) }));

  return <AbandonedCartsWorkspace carts={cartRows} leads={leadRows} popup={popup} coupons={couponOptions} />;
}

function PageSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading carts">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl bg-surface" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-2xl bg-surface" />
      <Skeleton className="h-10 rounded-full bg-surface" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
export const instant = false;
