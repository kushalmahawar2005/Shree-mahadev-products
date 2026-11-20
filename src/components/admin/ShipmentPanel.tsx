"use client";

import { useRouter } from "next/navigation";
import { unwrap } from "@/lib/action-result";
import { useState, useTransition } from "react";
import {
  CircleCheck,
  CircleX,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  Printer,
  RefreshCw,
  Truck,
  Undo2,
} from "lucide-react";
import {
  bookShipmentAction,
  cancelShipmentAction,
  labelUrlAction,
  quoteCouriersAction,
  requestPickupAction,
  refreshTrackingAction,
  setOrderStatusAction,
} from "@/lib/admin-actions";
import { markRtoReceivedAction } from "@/lib/inventory-actions";
import type { OrderStatus } from "@/lib/server/orders";
import type { CourierQuote, Shipment } from "@/lib/server/shipments";
import { ProviderTag } from "./ProviderTag";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "./order/ConfirmAction";
import { CopyButton } from "./order/CopyButton";

const field = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15";
const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50";
const ghost = cn(btn, "border border-line bg-surface text-forest-text hover:border-forest/50");

const SHIP_LABEL: Record<string, string> = {
  booking: "Booking… (check NimbusPost)",
  booked: "Booked",
  picked: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  ndr: "Delivery attempt failed",
  delivered: "Delivered",
  rto: "Returning (RTO)",
  cancelled: "Cancelled",
};

const when = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(String(d).replace(" ", "T") + "+05:30"));

const WHY_NOT: Partial<Record<OrderStatus, string>> = {
  pending_payment: "Waiting for the customer's payment. Book the shipment once it's paid.",
  payment_failed: "Payment failed, so there's nothing to ship.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
  delivered: "Delivered. Nothing left to ship.",
};

export function ShipmentPanel({
  orderId,
  status,
  initialShipments,
  defaultWeight,
  defaultDims,
  suggestedCourierId,
  configured,
}: {
  orderId: number;
  status: OrderStatus;
  initialShipments: Shipment[];
  defaultWeight: number;
  defaultDims: { length: number; breadth: number; height: number };
  suggestedCourierId: string | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [shipments, setShipments] = useState(initialShipments);
  const [orderStatus, setOrderStatus] = useState(status);
  const [weight, setWeight] = useState(defaultWeight);
  const [dims, setDims] = useState(defaultDims);
  const [quotes, setQuotes] = useState<CourierQuote[] | null>(null);
  const [courier, setCourier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = shipments.find((s) => s.status !== "cancelled");
  const canShip = !active && ["paid", "cod_pending", "confirmed"].includes(orderStatus);

  /** Runs an action; refreshes the server page so header, progress and history stay in sync. */
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError((e as Error).message || "Something went wrong");
      }
    });

  const statusActions = (
    <div className="flex flex-wrap gap-2">
      {orderStatus === "cod_pending" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => (unwrap(await setOrderStatusAction(orderId, "confirmed", "COD confirmed with customer")), setOrderStatus("confirmed")))}
          className={ghost}
        >
          <CircleCheck className="size-4" /> Mark COD confirmed
        </button>
      )}
      {orderStatus === "rto" && (
        <ConfirmAction
          trigger={
            <button type="button" disabled={pending} className={ghost}>
              <Undo2 className="size-4" /> RTO received back
            </button>
          }
          title="Has the returned parcel reached you?"
          description="Its items will be added back to stock."
          confirmLabel="Yes, restock"
          onConfirm={() => run(async () => void (unwrap(await markRtoReceivedAction(orderId))))}
        />
      )}
      {["shipped", "packed"].includes(orderStatus) && (
        <ConfirmAction
          trigger={
            <button type="button" disabled={pending} className={ghost}>
              <PackageCheck className="size-4" /> Mark delivered
            </button>
          }
          title="Mark this order delivered?"
          description="Use this only if the courier delivered it but tracking hasn't updated."
          confirmLabel="Mark delivered"
          onConfirm={() => run(async () => (unwrap(await setOrderStatusAction(orderId, "delivered", "Marked delivered by admin")), setOrderStatus("delivered")))}
        />
      )}
      {!active && !["cancelled", "delivered", "refunded"].includes(orderStatus) && (
        <ConfirmAction
          trigger={
            <button type="button" disabled={pending} className={cn(btn, "text-red-700 hover:bg-red-50")}>
              <CircleX className="size-4" /> Cancel order
            </button>
          }
          title="Cancel this order?"
          description="The customer is notified by email. Stock is released. Refunds for paid orders are done separately."
          confirmLabel="Cancel order"
          destructive
          reasonLabel="Reason (saved in order history)"
          onConfirm={(why) => run(async () => (unwrap(await setOrderStatusAction(orderId, "cancelled", why)), setOrderStatus("cancelled")))}
        />
      )}
    </div>
  );

  if (!configured) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-warm p-4 text-sm text-sale ring-1 ring-warm-line">
          NimbusPost isn&apos;t connected. Add the NIMBUSPOST_* keys to book shipments from here.
        </p>
        {statusActions}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      {active && (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="flex flex-wrap items-start justify-between gap-3 bg-subtle p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-forest-fg">
                <Truck className="size-5" />
              </span>
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-forest-text">
                  {active.courier ?? "Courier"} <ProviderTag provider={active.provider} />
                </p>
                <p className="flex items-center gap-1 text-sm text-ink-muted">
                  AWB <span className="font-mono text-ink">{active.awb}</span>
                  {active.awb && <CopyButton value={active.awb} label="AWB" />}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                active.status === "delivered" ? "bg-forest/10 text-forest-fg" : active.status === "rto" ? "bg-red-100 text-red-800" : "bg-warm-strong text-sale",
              )}
            >
              {SHIP_LABEL[active.status] ?? active.status.replace(/_/g, " ")}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-px bg-line text-sm sm:grid-cols-4">
            {[
              ["Booked", when(active.createdAt)],
              ["Expected", active.expectedDelivery ? new Date(`${active.expectedDelivery}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"],
              ["Pickup", active.pickupRequested ? "Requested" : active.status === "booked" ? "Not requested" : "Done"],
              ["Shipping cost", active.charged != null ? formatMoney(active.charged) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-4 py-3">
                <dt className="text-xs text-ink-muted">{k}</dt>
                <dd className="font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // Open the tab synchronously (popup blockers), then point it at the fresh label link.
                const tab = window.open("", "_blank");
                start(async () => {
                  setError(null);
                  try {
                    const url = unwrap(await labelUrlAction(orderId));
                    if (tab) tab.location.href = url;
                    else window.location.href = url;
                  } catch (e) {
                    tab?.close();
                    setError((e as Error).message || "Couldn't get the label");
                  }
                });
              }}
              className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}
            >
              <Printer className="size-4" /> Print label
            </button>
            {!active.pickupRequested && active.status === "booked" && (
              <button type="button" disabled={pending} onClick={() => run(async () => setShipments(unwrap(await requestPickupAction(orderId))))} className={ghost}>
                <Truck className="size-4" /> Request pickup
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => run(async () => setShipments(unwrap(await refreshTrackingAction(orderId))))} className={ghost}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh tracking
            </button>
            {active.trackingUrl && (
              <a href={active.trackingUrl} target="_blank" rel="noreferrer" className={ghost}>
                <ExternalLink className="size-4" /> Tracking page
              </a>
            )}
            {!["delivered", "rto"].includes(active.status) && (
              <ConfirmAction
                trigger={
                  <button type="button" disabled={pending} className={cn(btn, "ml-auto text-red-700 hover:bg-red-50")}>
                    Cancel shipment
                  </button>
                }
                title={`Cancel shipment ${active.awb ?? ""}?`}
                description="NimbusPost cancels the booking and the order goes back to “to ship”. You can book again after."
                confirmLabel="Cancel shipment"
                destructive
                onConfirm={() =>
                  run(async () => {
                    setShipments(unwrap(await cancelShipmentAction(orderId)));
                    setOrderStatus(orderStatus === "packed" ? "paid" : orderStatus);
                  })
                }
              />
            )}
          </div>

          {active.events.length > 0 && (
            <div className="border-t border-line p-4">
              <p className="mb-3 text-xs font-semibold text-ink-muted">Tracking</p>
              <ol className="relative max-h-72 space-y-4 overflow-y-auto pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
                {active.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className={cn("absolute -left-6 top-1 size-[15px] rounded-full border-2 border-surface", i === 0 ? "bg-forest-fg ring-4 ring-forest/15" : "bg-line")}
                    />
                    <p className={cn("text-sm", i === 0 ? "font-semibold text-forest-text" : "text-ink")}>{e.message ?? SHIP_LABEL[e.status] ?? e.status}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      {when(e.at)}
                      {e.location && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="size-3" /> {e.location}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {canShip && (
        <div className="space-y-4 rounded-xl border border-line p-4">
          <div>
            <p className="font-semibold text-forest-text">Book a shipment</p>
            <p className="text-sm text-ink-muted">Weight is prefilled from the catalog. Check the box size, then compare couriers.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-ink-muted">Weight (g)</span>
              <input type="number" min={50} className={field} value={weight} onChange={(e) => (setWeight(Number(e.target.value)), setQuotes(null))} />
            </label>
            {(["length", "breadth", "height"] as const).map((k) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block text-xs font-semibold capitalize text-ink-muted">{k} (cm)</span>
                <input type="number" min={1} className={field} value={dims[k]} onChange={(e) => (setDims({ ...dims, [k]: Number(e.target.value) }), setQuotes(null))} />
              </label>
            ))}
          </div>
          {!quotes && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const q = unwrap(await quoteCouriersAction(orderId, weight, dims));
                    setQuotes(q);
                    setCourier(q.find((c) => c.courierId === suggestedCourierId)?.courierId ?? q[0]?.courierId ?? null);
                  } catch (e) {
                    setError((e as Error).message || "Couldn't fetch rates");
                  }
                })
              }
              className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
              {pending ? "Fetching rates…" : "Compare courier rates"}
            </button>
          )}

          {quotes && quotes.length === 0 && <p className="text-sm text-sale">No courier serves this pincode for this weight.</p>}
          {quotes && quotes.length > 0 && (
            <>
              <ul role="radiogroup" aria-label="Courier" className="max-h-80 space-y-2 overflow-y-auto">
                {quotes.map((q, i) => (
                  <li key={q.courierId}>
                    <label
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors",
                        courier === q.courierId ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-line hover:border-forest/40",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <input type="radio" name="courier" checked={courier === q.courierId} onChange={() => setCourier(q.courierId)} className="accent-forest" />
                        <span>
                          <span className="font-semibold text-ink">{q.courierName}</span>
                          <span className="mt-0.5 flex flex-wrap gap-1.5">
                            <ProviderTag provider={q.provider} />
                            {i === 0 && <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest-fg">Cheapest</span>}
                            {q.courierId === suggestedCourierId && <span className="rounded-full bg-warm-strong px-2 py-0.5 text-[11px] font-semibold text-sale">Quoted at checkout</span>}
                            {q.tatDays ? <span className="text-xs text-ink-muted">{q.tatDays} days</span> : q.edd ? <span className="text-xs text-ink-muted">{q.edd}</span> : null}
                          </span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-bold tabular-nums text-forest-text">{formatMoney(Math.ceil(q.total))}</span>
                        {q.codCharge > 0 && <span className="block text-xs text-ink-muted">incl. COD {formatMoney(Math.ceil(q.codCharge))}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pending || !courier}
                  onClick={() =>
                    run(async () => {
                      setShipments(unwrap(await bookShipmentAction(orderId, courier!, weight, dims)));
                      setOrderStatus("packed");
                      setQuotes(null);
                    })
                  }
                  className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {pending ? "Booking…" : "Book shipment"}
                </button>
                <button type="button" onClick={() => setQuotes(null)} className={cn(btn, "text-ink-muted hover:bg-khaki-soft")}>
                  Change size
                </button>
              </div>
              <p className="text-xs text-ink-muted">Pickup is requested automatically. The cost is deducted from your NimbusPost wallet.</p>
            </>
          )}
        </div>
      )}

      {!active && !canShip && (
        <p className="rounded-xl bg-subtle p-4 text-sm text-ink-muted">{WHY_NOT[orderStatus] ?? "This order can't be shipped in its current state."}</p>
      )}

      {statusActions}
    </div>
  );
}
