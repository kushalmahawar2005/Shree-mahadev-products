/**
 * Pure GST maths for invoices and credit notes (no DB, no Next imports, so scripts can test it).
 * Everything is computed in integer paise; snapshots store rupees with two decimals.
 */

export type LineKind = "item" | "shipping" | "cod";

export type InvoiceLineInput = {
  kind: LineKind;
  title: string;
  size: string;
  sku: string | null;
  hsn: string | null;
  gstRate: number | null;
  quantity: number;
  /** Selling price per unit in whole rupees (as charged). */
  unitPrice: number;
};

export type InvoiceLine = {
  kind: LineKind;
  title: string;
  size: string;
  sku: string | null;
  hsn: string | null;
  gstRate: number;
  quantity: number;
  unitPrice: number;
  /** quantity × unitPrice, before discount (rupees). */
  gross: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  /** taxableValue + taxAmount. */
  lineTotal: number;
};

export type InvoiceTotals = {
  gross: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
};

export type TaxRule = { hsn: string; gstRate: number };

const rupees = (paise: number) => Math.round(paise) / 100;

/** Split a tax amount (paise) into CGST + SGST halves (SGST takes the odd paisa) or IGST. */
export function splitTax(taxPaise: number, intraState: boolean) {
  if (!intraState) return { cgst: 0, sgst: 0, igst: taxPaise };
  const cgst = Math.floor(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst, igst: 0 };
}

/** Tax-inclusive amount → taxable value + tax (paise). taxable = gross / (1 + rate). */
export function backCalculate(grossPaise: number, rate: number) {
  const taxable = Math.round((grossPaise * 100) / (100 + rate));
  return { taxable, tax: grossPaise - taxable };
}

/** HSN/GST for an item: product's own values → per-product override → category default. */
export function resolveTaxRule(
  product: { handle: string | null; category: string | null; hsn: string | null; gstRate: number | null },
  config: { productOverrides: Record<string, TaxRule>; categories: Record<string, TaxRule> },
): { hsn: string | null; gstRate: number | null } {
  const override = product.handle ? config.productOverrides[product.handle] : undefined;
  const category = product.category ? config.categories[product.category] : undefined;
  return {
    hsn: product.hsn || override?.hsn || category?.hsn || null,
    gstRate: product.gstRate ?? override?.gstRate ?? category?.gstRate ?? null,
  };
}

/** Rate of the highest-value item (composite supply rule for shipping / COD fee). */
export function principalRate(items: { gstRate: number | null; unitPrice: number; quantity: number }[]) {
  let best = { value: -1, rate: 0 };
  for (const item of items) {
    const value = item.unitPrice * item.quantity;
    if (value > best.value) best = { value, rate: item.gstRate ?? 0 };
  }
  return best.rate;
}

/**
 * Build invoice lines. `discount` (whole rupees) is shared across item lines in proportion to
 * their value (last item absorbs the rounding); shipping/COD lines are never discounted.
 */
export function buildInvoice(
  input: InvoiceLineInput[],
  options: { gstRegistered: boolean; intraState: boolean; pricesIncludeGst: boolean; discount: number },
): { lines: InvoiceLine[]; totals: InvoiceTotals } {
  const items = input.filter((line) => line.kind === "item");
  const itemsGross = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  // Discount shares are whole rupees (the last item absorbs the remainder).
  let discountLeft = Math.min(Math.max(0, options.discount), itemsGross);
  const discountTotal = discountLeft;
  let itemIndex = 0;
  const sums = { gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };

  const lines = input.map((line): InvoiceLine => {
    const grossPaise = line.unitPrice * line.quantity * 100;
    let share = 0;
    if (line.kind === "item") {
      itemIndex += 1;
      share = itemIndex === items.length
        ? discountLeft
        : itemsGross > 0 ? Math.min(discountLeft, Math.round((discountTotal * line.unitPrice * line.quantity) / itemsGross)) : 0;
      discountLeft -= share;
      share *= 100;
    }
    const net = Math.max(0, grossPaise - share);
    const rate = options.gstRegistered ? (line.gstRate ?? 0) : 0;
    let taxable = net;
    let tax = 0;
    if (options.gstRegistered && rate > 0) {
      if (options.pricesIncludeGst) ({ taxable, tax } = backCalculate(net, rate));
      else tax = Math.round((net * rate) / 100);
    }
    const split = splitTax(tax, options.intraState);
    sums.gross += grossPaise; sums.discount += share; sums.taxable += taxable;
    sums.cgst += split.cgst; sums.sgst += split.sgst; sums.igst += split.igst;
    return {
      kind: line.kind, title: line.title, size: line.size, sku: line.sku, hsn: line.hsn, gstRate: rate,
      quantity: line.quantity, unitPrice: line.unitPrice, gross: rupees(grossPaise), discount: rupees(share),
      taxableValue: rupees(taxable), cgst: rupees(split.cgst), sgst: rupees(split.sgst), igst: rupees(split.igst),
      taxAmount: rupees(tax), lineTotal: rupees(taxable + tax),
    };
  });

  const tax = sums.cgst + sums.sgst + sums.igst;
  const exact = sums.taxable + tax;
  const grand = Math.round(exact / 100) * 100;
  return {
    lines,
    totals: {
      gross: rupees(sums.gross), discount: rupees(sums.discount), taxable: rupees(sums.taxable),
      cgst: rupees(sums.cgst), sgst: rupees(sums.sgst), igst: rupees(sums.igst), tax: rupees(tax),
      roundOff: rupees(grand - exact), grandTotal: rupees(grand),
    },
  };
}

/**
 * Credit note lines for `amount` whole rupees against an invoice: the amount is spread over the
 * invoice lines by their value, then each share is back-calculated at that line's GST rate.
 */
export function buildCreditLines(
  invoiceLines: InvoiceLine[],
  amount: number,
  options: { intraState: boolean },
): { lines: InvoiceLine[]; totals: InvoiceTotals } {
  const base = invoiceLines.map((line) => Math.round(line.lineTotal * 100));
  const baseTotal = base.reduce((a, b) => a + b, 0);
  const target = Math.min(Math.round(amount * 100), baseTotal);
  let left = target;
  const sums = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const lines = invoiceLines.map((line, index): InvoiceLine => {
    const share = index === invoiceLines.length - 1 ? left : baseTotal ? Math.min(left, Math.round((target * base[index]) / baseTotal)) : 0;
    left -= share;
    const { taxable, tax } = line.gstRate > 0 ? backCalculate(share, line.gstRate) : { taxable: share, tax: 0 };
    const split = splitTax(tax, options.intraState);
    sums.taxable += taxable; sums.cgst += split.cgst; sums.sgst += split.sgst; sums.igst += split.igst;
    return {
      ...line, discount: 0, gross: rupees(share), taxableValue: rupees(taxable), cgst: rupees(split.cgst),
      sgst: rupees(split.sgst), igst: rupees(split.igst), taxAmount: rupees(tax), lineTotal: rupees(share),
    };
  }).filter((line) => line.lineTotal > 0);
  const tax = sums.cgst + sums.sgst + sums.igst;
  return {
    lines,
    totals: {
      gross: rupees(target), discount: 0, taxable: rupees(sums.taxable), cgst: rupees(sums.cgst), sgst: rupees(sums.sgst),
      igst: rupees(sums.igst), tax: rupees(tax), roundOff: 0, grandTotal: rupees(target),
    },
  };
}

/** Indian financial year ("2026-27") for a calendar date in IST. April starts a new year. */
export function financialYearFor(date: Date) {
  const ist = new Date(date.getTime() + 330 * 60_000);
  const month = ist.getUTCMonth();
  const year = ist.getUTCFullYear();
  const start = month >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** "YYYY-MM-DD" in IST. */
export function istDate(date: Date) {
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function documentNumber(prefix: string, fy: string, seq: number, digits: number) {
  return `${prefix}/${fy}/${String(seq).padStart(digits, "0")}`;
}

const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function underThousand(n: number): string {
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`;
}
function integerWords(value: number) {
  let n = value;
  const words: string[] = [];
  for (const [base, name] of [[10_000_000, "crore"], [100_000, "lakh"], [1_000, "thousand"], [1, ""]] as const) {
    const units = Math.floor(n / base);
    if (units) {
      // Above 99 crore the crore count itself is spelt out in the Indian system ("one hundred crore").
      words.push(`${base === 10_000_000 && units >= 1000 ? integerWords(units) : underThousand(units)}${name ? ` ${name}` : ""}`);
      n %= base;
    }
  }
  return words.join(" ");
}

/** 1234.5 → "Rupees one thousand two hundred thirty four and fifty paise only" (Indian grouping). */
export function amountInWords(amount: number) {
  const paiseTotal = Math.max(0, Math.round(amount * 100));
  const whole = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const main = whole ? `${integerWords(whole)} rupees` : paise ? "" : "zero rupees";
  const tail = paise ? `${main ? " and " : ""}${underThousand(paise)} paise` : "";
  return `${main}${tail} only`.replace(/\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
}
