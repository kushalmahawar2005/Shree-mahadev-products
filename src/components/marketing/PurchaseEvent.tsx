"use client";

import { useEffect } from "react";
import { emitMarketingEvent } from "@/lib/marketing-events";

export function PurchaseEvent({
  orderNo,
  total,
  items,
}: {
  orderNo: string;
  total: number;
  items: { productHandle: string; quantity: number; unitPrice: number }[];
}) {
  useEffect(() => {
    const key = `smp_purchase_${orderNo}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    emitMarketingEvent("Purchase", {
      value: total,
      currency: "INR",
      transaction_id: orderNo,
      items: items.map((item) => ({
        item_id: item.productHandle,
        quantity: item.quantity,
        price: item.unitPrice,
      })),
    }, orderNo);
  }, [items, orderNo, total]);
  return null;
}
