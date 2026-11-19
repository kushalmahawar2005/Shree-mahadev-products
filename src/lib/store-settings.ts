import { z } from "zod";

/** Store settings edited in /admin/settings (MySQL `settings` table). src/data/site.ts is only the fallback. */
const phone = z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, "Enter a valid phone number");
const url = z.string().trim().url("Enter a full link starting with https://").max(300);

export const BusinessSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  gstin: z.string().trim().toUpperCase().refine((v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), "GSTIN looks wrong (15 characters)").default(""),
  fssai: z.string().trim().regex(/^\d{14}$/, "FSSAI number has 14 digits"),
  fssaiExpiry: z.string().trim().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD").default(""),
  iso: z.string().trim().max(60).default(""),
  phone,
  whatsapp: z.string().trim().regex(/^91\d{10}$/, "WhatsApp: 91 + 10-digit number, e.g. 918440099585"),
  email: z.string().trim().email(),
  supportHours: z.string().trim().min(3).max(60),
  addressLine1: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().max(80).default(""),
  state: z.string().trim().min(2).max(60),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "6-digit pincode"),
});

export const ShippingSchema = z.object({
  freeShippingThreshold: z.number().int().min(0).max(100_000),
  codEnabled: z.boolean(),
  codMaxOrder: z.number().int().min(0).max(1_000_000), // 0 = no limit
  flatShippingFee: z.number().int().min(0).max(5_000), // used when courier rates are unavailable
  flatCodFee: z.number().int().min(0).max(5_000),
});

export const AnnouncementSchema = z.object({
  intervalSec: z.number().int().min(2).max(30),
  messages: z
    .array(
      z.object({
        text: z.string().trim().min(3).max(90),
        href: z.string().trim().max(200).refine((v) => !v || v.startsWith("/") || v.startsWith("https://"), "Link must start with / or https://").default(""),
        startsAt: z.string().trim().default(""), // YYYY-MM-DD, optional
        endsAt: z.string().trim().default(""),
      }),
    )
    .max(3),
});

export const SocialsSchema = z.array(z.object({ label: z.string().trim().min(2).max(30), href: url })).max(8);

export const StoreSettingsSchema = z.object({
  business: BusinessSchema,
  pricesIncludeGst: z.boolean().default(true),
  shipping: ShippingSchema,
  announcement: AnnouncementSchema,
  socials: SocialsSchema,
  lowStockThreshold: z.number().int().min(0).max(1000),
  /** Which gateway takes online payments. Falls back to the other one if its keys are missing. */
  paymentGateway: z.enum(["payu", "cashfree"]).default("payu"),
});

export type StoreSettings = z.infer<typeof StoreSettingsSchema>;

// Defaults + liveAnnouncements live in a zod-free module so client components can import them
// without shipping zod to the browser.
export { DEFAULT_SETTINGS, liveAnnouncements } from "./store-settings-defaults";
