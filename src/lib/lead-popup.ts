import { z } from "zod";

/** Admin knobs for the storefront welcome-offer popup (settings key `lead_popup`). */
export const LeadPopupSchema = z.object({
  enabled: z.boolean(),
  delaySec: z.number().int().min(3).max(120),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{0,30}$/, "Pick a valid coupon"),
});
export type LeadPopupConfig = z.infer<typeof LeadPopupSchema>;

export const DEFAULT_LEAD_POPUP: LeadPopupConfig = { enabled: false, delaySec: 10, couponCode: "" };

/** What the storefront needs. The coupon code itself is only revealed after the form is submitted. */
export type PublicLeadPopup = { delaySec: number; percent: number } | null;

export const LeadSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number")),
  page: z.string().trim().max(255).default("/"),
});
