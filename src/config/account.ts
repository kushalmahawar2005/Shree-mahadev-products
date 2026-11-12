import { site } from "@/data/site";

/** Account area settings (placeholders until the client confirms). */
export const accountConfig = {
  /** Unpaid online orders auto-cancel (and restock) after this many hours. */
  pendingOrderExpiryHours: 24,
  /** Returns can be requested this many days after delivery… */
  returnWindowDays: 7,
  /** …for these product categories only (sealed food; honey/oil leaks or damage in transit). */
  returnEligibleCategories: ["oil", "honey", "sweetener"] as const,
  maxAddresses: 10,
  support: {
    hours: site.supportHours,
    whatsapp: site.whatsapp,
  },
} as const;
