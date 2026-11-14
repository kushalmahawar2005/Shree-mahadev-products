import { announcements as defaultAnnouncements, site } from "@/data/site";
import type { StoreSettings } from "./store-settings";

/** Fallback store settings (no zod here: StoreSettingsProvider imports this on every page). */
export const DEFAULT_SETTINGS: StoreSettings = {
  pricesIncludeGst: true, // TODO(client): confirm catalog prices include GST before go-live.
  business: {
    legalName: site.name,
    gstin: "08AFPPT8337M3ZC",
    fssai: site.fssai,
    fssaiExpiry: "",
    iso: site.iso,
    phone: site.phone,
    whatsapp: site.whatsapp,
    email: site.email,
    supportHours: site.supportHours,
    addressLine1: site.address.line1,
    city: site.address.city,
    district: site.address.district,
    state: site.address.state,
    postalCode: site.address.postalCode,
  },
  shipping: {
    freeShippingThreshold: site.freeShippingThreshold,
    codEnabled: site.codAvailable,
    codMaxOrder: 0,
    flatShippingFee: site.shippingFee,
    flatCodFee: site.codFee,
  },
  announcement: {
    intervalSec: 4,
    messages: defaultAnnouncements.map((text) => ({ text, href: "", startsAt: "", endsAt: "" })),
  },
  socials: [...site.socials],
  lowStockThreshold: 5,
};

/** Messages live today (IST date), with {threshold} replaced. */
export function liveAnnouncements(s: StoreSettings, today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)) {
  return s.announcement.messages
    .filter((m) => (!m.startsAt || m.startsAt <= today) && (!m.endsAt || m.endsAt >= today))
    .map((m) => ({ ...m, text: m.text.replace(/\{threshold\}/g, `₹${s.shipping.freeShippingThreshold}`) }));
}
