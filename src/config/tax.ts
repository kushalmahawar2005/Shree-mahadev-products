/**
 * GST invoice + credit note settings.
 *
 * TODO(CA): every value marked TODO(CA) must be confirmed by the client's chartered accountant
 * before go-live. Seller details saved in Admin → Settings → Business (legal name, GSTIN, FSSAI,
 * address, state) win over the fallbacks here; this file fills whatever the settings leave empty.
 */

export type TaxRule = { hsn: string; gstRate: number };

export const taxConfig = {
  /** Fallback when Admin → Settings → Business → GSTIN is empty. Empty = not GST registered
   *  (documents are issued as "Bill of supply" without tax). TODO(CA): client's 15-char GSTIN. */
  sellerGstin: "",
  /** Seller's GST state. Rajasthan = 08. Derived from the GSTIN's first two digits when one is set. */
  sellerState: "Rajasthan",
  sellerStateCode: "08",
  /** Fallback FSSAI licence no. (settings → business → fssai wins). */
  fssaiLicense: "12226047000007",

  /** Default HSN + GST rate per product category (products.category). TODO(CA): confirm all. */
  categories: {
    oil: { hsn: "1514", gstRate: 5 }, // TODO(CA): edible vegetable oils (mustard 1514, groundnut 1508, sesame 1515…)
    honey: { hsn: "0409", gstRate: 5 }, // TODO(CA): natural honey, pre-packaged + labelled
    sweetener: { hsn: "1701", gstRate: 5 }, // TODO(CA): jaggery / khand, pre-packaged + labelled
  } satisfies Record<string, TaxRule>,

  /**
   * Per-product HSN/GST overrides by product handle. Precedence when building an invoice line:
   * HSN/GST saved on the product in Admin → Products → this map → the category default above.
   * TODO(CA): confirm each HSN; castor oil is non-edible and may carry a different rate.
   */
  productOverrides: {
    "groundnut-oil": { hsn: "1508", gstRate: 5 },
    "yellow-mustard-oil": { hsn: "1514", gstRate: 5 },
    "black-mustard-oil": { hsn: "1514", gstRate: 5 },
    "black-sesame-oil": { hsn: "1515", gstRate: 5 },
    "white-sesame-oil": { hsn: "1515", gstRate: 5 },
    "brown-sesame-oil": { hsn: "1515", gstRate: 5 },
    "flaxseed-oil": { hsn: "1515", gstRate: 5 },
    "coconut-oil": { hsn: "1513", gstRate: 5 },
    "sunflower-oil": { hsn: "1512", gstRate: 5 },
    "almond-oil": { hsn: "1515", gstRate: 5 },
    "walnut-oil": { hsn: "1515", gstRate: 5 },
    "castor-oil": { hsn: "1515", gstRate: 5 }, // TODO(CA): non-edible castor oil rate
  } as Record<string, TaxRule>,

  /** Shipping charge line. "principal" = the rate of the highest-value item on the invoice
   *  (composite supply). TODO(CA): confirm "principal" vs a fixed rate such as 18. */
  shipping: { hsn: "996812", gstRate: "principal" as number | "principal" },
  /** COD handling fee line. TODO(CA): confirm SAC + rate. */
  codFee: { hsn: "996812", gstRate: "principal" as number | "principal" },

  /** "SMP/2026-27/000123" and "SMP/CN/2026-27/000045". Sequences never reset within a FY. */
  invoicePrefix: "SMP",
  creditNotePrefix: "SMP/CN",
  numberDigits: 6,

  /** COD orders get their invoice once dispatched. Add "packed" to print the invoice with the
   *  parcel at shipment booking. TODO(CA/client). Online orders get it when payment is captured. */
  codInvoiceStatuses: ["shipped", "delivered"] as string[],

  /** Optional signature image (absolute https URL or a file under /public, e.g. "/brand/sign.png"). */
  signatureImageUrl: undefined as string | undefined,
  /** Brand logo printed in the PDF header (file under /public). */
  logoPath: "/logo.png",

  declaration:
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
} as const;

/** GST state codes (place of supply). */
export const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01", "Himachal Pradesh": "02", Punjab: "03", Chandigarh: "04", Uttarakhand: "05",
  Haryana: "06", Delhi: "07", Rajasthan: "08", "Uttar Pradesh": "09", Bihar: "10", Sikkim: "11",
  "Arunachal Pradesh": "12", Nagaland: "13", Manipur: "14", Mizoram: "15", Tripura: "16", Meghalaya: "17",
  Assam: "18", "West Bengal": "19", Jharkhand: "20", Odisha: "21", Chhattisgarh: "22", "Madhya Pradesh": "23",
  Gujarat: "24", "Dadra and Nagar Haveli and Daman and Diu": "26", Maharashtra: "27", Karnataka: "29", Goa: "30",
  Lakshadweep: "31", Kerala: "32", "Tamil Nadu": "33", Puducherry: "34", "Andaman and Nicobar Islands": "35",
  Telangana: "36", "Andhra Pradesh": "37", Ladakh: "38",
};

const byLowerName = new Map(Object.entries(GST_STATE_CODES).map(([name, code]) => [name.toLowerCase().replace(/[^a-z]/g, ""), code]));
const aliases: Record<string, string> = { orissa: "21", pondicherry: "34", newdelhi: "07", nctofdelhi: "07", uttaranchal: "05", jammukashmir: "01" };

/** "Rajasthan" → "08". Empty string when unknown. */
export function gstStateCode(state: string): string {
  const key = state.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
  return byLowerName.get(key) ?? aliases[key] ?? "";
}
