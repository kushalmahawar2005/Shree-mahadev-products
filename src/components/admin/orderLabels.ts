import type { Order } from "@/lib/server/orders";

export const ORDER_LABEL: Record<Order["status"], { text: string; tone: "green" | "amber" | "red" | "gray" }> = {
  paid: { text: "Paid", tone: "green" },
  cod_pending: { text: "COD", tone: "amber" },
  pending_payment: { text: "Awaiting payment", tone: "gray" },
  payment_failed: { text: "Payment failed", tone: "red" },
  confirmed: { text: "Confirmed", tone: "green" },
  packed: { text: "Shipment booked", tone: "amber" },
  shipped: { text: "In transit", tone: "green" },
  delivered: { text: "Delivered", tone: "green" },
  cancelled: { text: "Cancelled", tone: "red" },
  rto: { text: "RTO", tone: "red" },
  refunded: { text: "Refunded", tone: "gray" },
  partially_refunded: { text: "Partly refunded", tone: "amber" },
};
