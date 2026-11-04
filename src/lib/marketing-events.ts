"use client";

export type MarketingEventName = "PageView" | "ViewContent" | "Search" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase" | "Lead" | "Contact" | "CODConfirmed";
export type MarketingEvent = { name: MarketingEventName; eventId: string; params?: Record<string, unknown> };

export function emitMarketingEvent(name: MarketingEventName, params: Record<string, unknown> = {}, eventId = crypto.randomUUID()) {
  if (typeof window === "undefined") return eventId;
  window.dispatchEvent(new CustomEvent<MarketingEvent>("smp:marketing-event", { detail: { name, eventId, params } }));
  return eventId;
}
