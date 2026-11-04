"use client";

import { useState, useTransition } from "react";
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
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const num = "min-h-10 w-full rounded-xl border border-line px-3 text-sm";
const btn = "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-50";

export function ShipmentPanel({
  orderId,
  status,
  initialShipments,
  defaultWeight,
  suggestedCourierId,
  configured,
}: {
  orderId: number;
  status: OrderStatus;
  initialShipments: Shipment[];
  defaultWeight: number;
  suggestedCourierId: string | null;
  configured: boolean;
}) {
  const [shipments, setShipments] = useState(initialShipments);
  const [orderStatus, setOrderStatus] = useState(status);
  const [weight, setWeight] = useState(defaultWeight);
  const [dims, setDims] = useState({ length: 20, breadth: 15, height: 15 });
  const [quotes, setQuotes] = useState<CourierQuote[] | null>(null);
  const [courier, setCourier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = shipments.find((s) => s.status !== "cancelled");
  const canShip = !active && ["paid", "cod_pending", "confirmed"].includes(orderStatus);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message || "Something went wrong");
      }
    });

  if (!configured) {
    return <p className="text-sm text-sale">NimbusPost is not connected. Add NIMBUSPOST_* env vars to book shipments from here.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {active && (
        <div className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-forest-text">
                {active.courier ?? "Courier"} · AWB {active.awb}
              </p>
              <p className="text-sm text-ink-muted">
                Status: <strong>{active.status.replace(/_/g, " ")}</strong> · booked {active.createdAt.slice(0, 16)}
                {active.charged != null && ` · wallet charged ${formatMoney(active.charged)}`}
                {active.pickupRequested ? " · pickup requested" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  // Open the tab synchronously (popup blockers), then point it at the fresh label link.
                  const tab = window.open("", "_blank");
                  run(async () => {
                    const url = await labelUrlAction(orderId);
                    if (tab) tab.location.href = url;
                    else window.location.href = url;
                  });
                }}
                className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}
              >
                Print label
              </button>
              {!active.pickupRequested && active.status === "booked" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(async () => setShipments(await requestPickupAction(orderId)))}
                  className={cn(btn, "border border-line hover:border-forest/50")}
                >
                  Request pickup
                </button>
              )}
              {active.trackingUrl && (
                <a href={active.trackingUrl} target="_blank" rel="noreferrer" className={cn(btn, "border border-line hover:border-forest/50")}>
                  Tracking page
                </a>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(async () => setShipments(await refreshTrackingAction(orderId)))}
                className={cn(btn, "border border-line hover:border-forest/50")}
              >
                Refresh tracking
              </button>
              {!["delivered", "rto"].includes(active.status) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Cancel shipment ${active.awb}? The order goes back to "to ship".`)) return;
                    run(async () => {
                      setShipments(await cancelShipmentAction(orderId));
                      setOrderStatus(orderStatus === "packed" ? "paid" : orderStatus);
                    });
                  }}
                  className={cn(btn, "text-red-700 hover:bg-red-50")}
                >
                  Cancel shipment
                </button>
              )}
            </div>
          </div>
          {active.events.length > 0 && (
            <ol className="mt-3 max-h-56 space-y-1.5 overflow-y-auto border-t border-line pt-3 text-sm">
              {active.events.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{e.message ?? e.status}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {e.at.slice(0, 16)}
                    {e.location ? ` · ${e.location}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {canShip && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Weight (g)</span>
              <input type="number" min={50} className={num} value={weight} onChange={(e) => (setWeight(Number(e.target.value)), setQuotes(null))} />
            </label>
            {(["length", "breadth", "height"] as const).map((k) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block font-semibold capitalize">{k} (cm)</span>
                <input
                  type="number"
                  min={1}
                  className={num}
                  value={dims[k]}
                  onChange={(e) => (setDims({ ...dims, [k]: Number(e.target.value) }), setQuotes(null))}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const q = await quoteCouriersAction(orderId, weight, dims);
                setQuotes(q);
                setCourier(q.find((c) => c.courierId === suggestedCourierId)?.courierId ?? q[0]?.courierId ?? null);
              })
            }
            className={cn(btn, "border border-forest text-forest hover:bg-forest/5")}
          >
            {pending && !quotes ? "Fetching rates…" : "Get courier rates"}
          </button>

          {quotes && quotes.length === 0 && <p className="text-sm text-sale">No courier serves this pincode for this weight.</p>}
          {quotes && quotes.length > 0 && (
            <>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {quotes.map((q, i) => (
                  <li key={q.courierId}>
                    <label
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm",
                        courier === q.courierId ? "border-forest bg-khaki-soft" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input type="radio" name="courier" checked={courier === q.courierId} onChange={() => setCourier(q.courierId)} className="accent-forest" />
                        <span>
                          <span className="font-semibold">{q.courierName}</span>
                          {i === 0 && <span className="ml-2 rounded-full bg-forest/10 px-2 text-xs text-forest">Cheapest</span>}
                          {q.courierId === suggestedCourierId && <span className="ml-2 rounded-full bg-mustard/20 px-2 text-xs">Quoted at checkout</span>}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold">{formatMoney(Math.ceil(q.total))}</span>
                        {q.codCharge > 0 && <span className="block text-xs text-ink-muted">incl. COD {formatMoney(Math.ceil(q.codCharge))}</span>}
                        {q.tatDays && <span className="block text-xs text-ink-muted">{q.tatDays} days</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={pending || !courier}
                onClick={() =>
                  run(async () => {
                    setShipments(await bookShipmentAction(orderId, courier!, weight, dims));
                    setOrderStatus("packed");
                    setQuotes(null);
                  })
                }
                className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}
              >
                {pending ? "Booking…" : "Book shipment"}
              </button>
              <p className="text-xs text-ink-muted">Pickup is requested automatically. The shipping cost is deducted from your NimbusPost wallet.</p>
            </>
          )}
        </div>
      )}

      {!active && !canShip && <p className="text-sm text-ink-muted">This order can&apos;t be shipped in its current state.</p>}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        {orderStatus === "cod_pending" && (
          <button type="button" disabled={pending} onClick={() => run(async () => (await setOrderStatusAction(orderId, "confirmed", "COD confirmed with customer"), setOrderStatus("confirmed")))} className={cn(btn, "border border-line")}>
            Mark COD confirmed
          </button>
        )}
        {orderStatus === "rto" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Has the returned parcel reached you? Its stock will be added back.")) {
                run(async () => void (await markRtoReceivedAction(orderId)));
              }
            }}
            className={cn(btn, "border border-line")}
          >
            RTO received back (restock)
          </button>
        )}
        {["shipped", "packed"].includes(orderStatus) && (
          <button type="button" disabled={pending} onClick={() => run(async () => (await setOrderStatusAction(orderId, "delivered", "Marked delivered by admin"), setOrderStatus("delivered")))} className={cn(btn, "border border-line")}>
            Mark delivered
          </button>
        )}
        {!active && !["cancelled", "delivered", "refunded"].includes(orderStatus) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const why = window.prompt("Reason for cancelling this order?");
              if (why === null) return;
              run(async () => (await setOrderStatusAction(orderId, "cancelled", why), setOrderStatus("cancelled")));
            }}
            className={cn(btn, "text-red-700 hover:bg-red-50")}
          >
            Cancel order
          </button>
        )}
      </div>
    </div>
  );
}
