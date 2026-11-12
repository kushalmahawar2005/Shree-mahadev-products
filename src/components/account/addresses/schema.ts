import { z } from "zod";

/* Shared by AddressForm (client) and address-actions (server). */

export const LABELS = ["home", "work", "other"] as const;
export type Label = (typeof LABELS)[number];
export const LABEL_TEXT: Record<Label, string> = {
  home: "Home",
  work: "Work",
  other: "Other",
};

export const addressSchema = z
  .object({
    pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit pincode."),
    name: z.string().trim().min(2, "Enter the full name.").max(120),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number starting with 6–9."),
    line1: z
      .string()
      .trim()
      .min(5, "Add house no., building and street.")
      .max(255),
    landmark: z.string().trim().max(120, "Keep the landmark short."),
    city: z.string().trim().min(2, "Enter the city.").max(80),
    state: z.string().trim().min(2, "Enter the state.").max(60),
    label: z.enum(LABELS),
    makeDefault: z.boolean(),
  })
  .strict();

export type AddressFormValues = z.input<typeof addressSchema>;
export type AddressPayload = z.output<typeof addressSchema>;

/** What the browser keeps for each saved address (mirrors SavedAddress on the server). */
export type AddressView = {
  id: number;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  label: Label;
  isDefault: boolean;
};
