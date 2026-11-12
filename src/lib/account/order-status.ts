/* Plain helpers (no "use client") so both Server and Client Components can call them. */

export const TIMELINE_STEPS = [
  "Ordered",
  "Packed",
  "Shipped",
  "Out for delivery",
  "Delivered",
] as const;

/** Index of the current step for a status (−1 = not on the delivery track, e.g. cancelled). */
export const stepOf = (status: string) =>
  ({
    pending_payment: 0,
    paid: 0,
    cod_pending: 0,
    confirmed: 0,
    packed: 1,
    shipped: 2,
    out_for_delivery: 3,
    delivered: 4,
  })[status] ?? -1;

/** "Arriving by Sat, 15 Nov" from a YYYY-MM-DD courier estimate. */
export function arrivingBy(eta: string | null) {
  if (!eta) return null;
  const d = new Date(`${eta}T12:00:00+05:30`);
  return `Arriving by ${new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d)}`;
}
