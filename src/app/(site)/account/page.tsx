import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  CircleHelp,
  CreditCard,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import { OrderCard } from "@/components/account/OrderCard";
import { Usuals } from "@/components/account/Usuals";
import { buildUsuals, productInfo } from "@/lib/account/usuals";
import { EmptyState, PageHeader } from "@/components/account/ui";
import { whatsappLink } from "@/data/site";
import { getProducts } from "@/lib/commerce";
import {
  ACTIVE_STATUSES,
  getAccountShell,
  listAccountOrders,
  usualVariants,
} from "@/lib/server/account";
import { defaultAddress } from "@/lib/server/account-addresses";
import { formatAddress, formatName, formatPhone } from "@/lib/utils/format";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "My account", robots: { index: false } };
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

const card =
  "rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6";

export default async function AccountOverview() {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const c = shell.customer;
  const [orders, usualIds, address, products] = await Promise.all([
    listAccountOrders(c.id, 20),
    usualVariants(c.id),
    defaultAddress(c.id),
    getProducts(),
  ]);

  const info = productInfo(products);
  const expired = (o: (typeof orders)[number]) => o.expiresInHours !== null && o.expiresInHours <= 0;
  const active = orders.filter(
    (o) =>
      (ACTIVE_STATUSES as readonly string[]).includes(o.status) && !expired(o),
  );
  const unpaid = active.find((o) => o.status === "pending_payment");
  const toRate = orders.find((o) => o.status === "delivered" && !o.reviewed);
  const lastDelivered = orders.find((o) => o.status === "delivered");

  const usual = buildUsuals(products, usualIds);

  const first = formatName(c.name).split(" ")[0] || "there";

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        eyebrow="मेरा खाता"
        title={`Namaste, ${first} 👋`}
        subtitle="Your orders, addresses and details, all in one place."
      />

      {/* Action banner: only when something needs the shopper */}
      {unpaid ? (
        <section
          className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center md:p-6"
          aria-label="Payment pending"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-amber-700 ring-1 ring-amber-200">
            <CreditCard className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">
              Payment pending for{" "}
              <span className="font-mono">{unpaid.orderNo}</span> ·{" "}
              {formatMoney(unpaid.total)}
            </p>
            <p className="text-sm text-amber-900/80">
              {unpaid.expiresInHours !== null ? `Auto-cancels in ${unpaid.expiresInHours}h if not paid.`
                : "Complete payment to confirm your order."}
            </p>
          </div>
          <div className="flex gap-2 max-sm:[&>*]:flex-1">
            <a
              href={`/checkout/pay?t=${unpaid.token}`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid"
            >
              Complete payment
            </a>
            <Link
              href={`/account/orders/${unpaid.id}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-ink hover:border-amber-400"
            >
              View
            </Link>
          </div>
        </section>
      ) : toRate ? (
        <section
          className="flex flex-col gap-4 rounded-3xl border border-co-accent/30 bg-co-accent-soft p-5 sm:flex-row sm:items-center md:p-6"
          aria-label="Rate your order"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-co-accent ring-1 ring-co-accent/30">
            <Star className="size-5" />
          </span>
          <p className="min-w-0 flex-1 font-semibold text-ink">
            How was your{" "}
            {toRate.items[0]?.title.replace(/^(Wood|Cold)-Pressed\s+/, "") ??
              "order"}
            ? Your review helps other families.
          </p>
          <Link
            href={`/review?t=${toRate.token}`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid"
          >
            Rate it
          </Link>
        </section>
      ) : null}

      {/* Active orders */}
      <section aria-labelledby="active-h">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="active-h" className="text-lg text-ink">
            Active orders
          </h2>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
          >
            All orders <ArrowRight className="size-4" />
          </Link>
        </div>
        {active.length ? (
          <div className="space-y-4">
            {active.slice(0, 2).map((o) => (
              <OrderCard key={o.id} order={o} info={info} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${card} flex items-center gap-3`}>
              <span className="grid size-10 place-items-center rounded-full bg-co-success-soft text-co-success">
                <PackageCheck className="size-5" />
              </span>
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">
                  No active orders.
                </span>{" "}
                Everything you ordered has reached you.
              </p>
            </div>
            {lastDelivered && (
              <OrderCard order={lastDelivered} info={info} variant="compact" />
            )}
          </div>
        )}
      </section>

      {/* Buy your usuals */}
      {usual.length > 0 && (
        <section aria-labelledby="usuals-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="usuals-h" className="text-lg text-ink">
              {usualIds.length
                ? "Buy your usuals"
                : "Bestsellers for your kitchen"}
            </h2>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
            >
              Shop all <ArrowRight className="size-4" />
            </Link>
          </div>
          <Usuals items={usual} />
        </section>
      )}

      {/* Quick actions */}
      <section
        aria-label="Quick actions"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {[
          { href: "/track-order", label: "Track an order", icon: Truck },
          { href: "/shop", label: "Shop again", icon: ShoppingBag },
          {
            href: whatsappLink(
              `Hi, I'm ${formatName(c.name)} (${formatPhone(c.phone)}). I need help with my account.`,
            ),
            label: "Chat on WhatsApp",
            icon: MessageCircle,
            external: true,
          },
          { href: "/account/help", label: "Help & FAQs", icon: CircleHelp },
        ].map(({ href, label, icon: Icon, external }) => (
          <Link
            key={label}
            href={href}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group flex min-h-[88px] flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-co-card transition-colors hover:border-co-border-strong"
          >
            <Icon className="size-5 text-co-accent" />
            <span className="flex items-center justify-between text-sm font-semibold text-ink">
              {label}{" "}
              <ArrowRight className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>

      {/* Default address */}
      <section aria-labelledby="addr-h">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="addr-h" className="text-lg text-ink">
            Delivery address
          </h2>
          <Link
            href="/account/addresses"
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
          >
            Manage <ArrowRight className="size-4" />
          </Link>
        </div>
        {address ? (
          <div className={`${card} flex gap-3`}>
            <MapPin className="mt-0.5 size-5 shrink-0 text-co-accent" />
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-ink">
                {formatName(address.name)}
                <span className="rounded-full bg-co-brand-soft px-2 py-0.5 text-[11px] font-bold text-forest">
                  Default
                </span>
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {formatAddress(address)}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {formatPhone(address.phone)}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            title="No address yet"
            text="It's saved automatically with your first order."
          />
        )}
      </section>
    </div>
  );
}
