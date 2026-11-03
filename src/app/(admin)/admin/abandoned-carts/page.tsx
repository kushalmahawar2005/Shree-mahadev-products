import { Suspense } from "react";
import { RemindButton } from "@/components/admin/RemindButton";
import { PageHeader, StatCard, StatusBadge, Table } from "@/components/admin/ui";
import { ABANDON_AFTER_MIN, listAdminCarts, type AdminCart } from "@/lib/server/carts";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Abandoned carts" };

export default function AbandonedCartsPage() {
  return (
    <>
      <PageHeader
        title="Abandoned carts"
        intro={`Carts idle for ${ABANDON_AFTER_MIN}+ minutes without an order, last 30 days. Contact details are saved as shoppers type them at checkout.`}
      />
      <Suspense fallback={<p className="text-ink-muted">Loading carts…</p>}>
        <Carts />
      </Suspense>
    </>
  );
}

function ago(ts: string) {
  const mins = Math.round((Date.now() - new Date(ts.replace(" ", "T") + "+05:30").getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

function recoveryMessage(c: AdminCart) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const first = c.name?.split(" ")[0];
  const items = c.items.map((i) => `${i.title} (${i.variant})`).join(", ");
  const text = `Namaste${first ? ` ${first}` : ""}! You left ${items} in your cart at Swadeshi Mahadev Products. Complete your order here: ${base}/cart/recover/${c.token}\nNeed help? Just reply to this message.`;
  return `https://wa.me/91${c.phone}?text=${encodeURIComponent(text)}`;
}

async function Carts() {
  let carts: AdminCart[];
  try {
    carts = await listAdminCarts();
  } catch (e) {
    console.error(e);
    return <p className="text-sale">Could not connect to the database. Check DATABASE_* env vars.</p>;
  }
  const open = carts.filter((c) => c.status === "abandoned");
  const recovered = carts.filter((c) => c.status === "recovered");
  const contacted = carts.filter((c) => c.reminderCount > 0);
  const reachable = open.filter((c) => c.phone);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Open carts" value={String(open.length)} note={`${reachable.length} with phone`} />
        <StatCard label="Value at risk" value={formatMoney(open.reduce((s, c) => s + c.subtotal, 0))} />
        <StatCard label="Recovered" value={String(recovered.length)} note={formatMoney(recovered.reduce((s, c) => s + c.subtotal, 0))} />
        <StatCard
          label="Recovery rate"
          value={contacted.length ? `${Math.round((recovered.length / contacted.length) * 100)}%` : "-"}
          note="of carts we messaged"
        />
      </div>
      {!open.length && !recovered.length ? (
        <p className="text-ink-muted">No abandoned carts yet.</p>
      ) : (
        <Table head={["Customer", "Items", "Value", "Last active", "Stage", "Status", "Recover"]}>
          {[...open, ...recovered].map((c) => (
            <tr key={c.id}>
              <td>
                {c.name ?? <span className="text-ink-muted">Anonymous</span>}
                <span className="block text-sm text-ink-muted">
                  {[c.phone && `+91 ${c.phone}`, c.pincode].filter(Boolean).join(" · ") || "No contact yet"}
                </span>
                {c.email && <span className="block text-sm text-ink-muted">{c.email}</span>}
              </td>
              <td>
                {c.items.map((i) => (
                  <span key={i.title + i.variant} className="block text-sm">
                    {i.qty} × {i.title} ({i.variant})
                  </span>
                ))}
              </td>
              <td>{formatMoney(c.subtotal)}</td>
              <td className="whitespace-nowrap text-ink-muted">{ago(c.lastActivityAt)}</td>
              <td className="text-sm">
                {c.orderStatus === "payment_failed" || c.orderStatus === "pending_payment"
                  ? `Payment failed (${c.orderNo})`
                  : c.reachedCheckout
                    ? "Reached checkout"
                    : "Added to cart"}
                {c.linkOpenedAt && <span className="block text-ink-muted">Opened link</span>}
              </td>
              <td>
                <StatusBadge tone={c.status === "recovered" ? "green" : c.reminderCount ? "gray" : "amber"}>
                  {c.status === "recovered" ? `Recovered ${c.orderNo ?? ""}` : c.reminderCount ? `Messaged ×${c.reminderCount}` : "Not contacted"}
                </StatusBadge>
              </td>
              <td>
                {c.status === "abandoned" && c.phone ? (
                  <RemindButton cartId={c.id} href={recoveryMessage(c)} again={c.reminderCount > 0} />
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
