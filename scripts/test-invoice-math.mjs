// Unit tests for GST invoice maths (pure, no DB/server). Run: node --experimental-strip-types scripts/test-invoice-math.mjs
import assert from "node:assert/strict";
import {
  amountInWords,
  backCalculate,
  buildCreditLines,
  buildInvoice,
  documentNumber,
  financialYearFor,
  principalRate,
  resolveTaxRule,
  splitTax,
} from "../src/lib/invoice-math.ts";
import { gstStateCode, taxConfig } from "../src/config/tax.ts";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };
const item = (unitPrice, quantity = 1, gstRate = 5, title = "Mustard oil") => ({ kind: "item", title, size: "1 L", sku: null, hsn: "1514", gstRate, quantity, unitPrice });
const opts = (o = {}) => ({ gstRegistered: true, intraState: true, pricesIncludeGst: true, discount: 0, ...o });
const intra = (state) => gstStateCode(state) === taxConfig.sellerStateCode;

t("state codes: Rajasthan is the seller state (08); others are not", () => {
  assert.equal(gstStateCode("Rajasthan"), "08");
  assert.equal(gstStateCode(" rajasthan "), "08");
  assert.equal(gstStateCode("Maharashtra"), "27");
  assert.equal(gstStateCode("Jammu & Kashmir"), "01");
  assert.equal(intra("Rajasthan"), true);
  assert.equal(intra("Maharashtra"), false);
});

t("Rajasthan address → CGST + SGST, back-calculated from the inclusive price", () => {
  const { lines, totals } = buildInvoice([item(1000)], opts({ intraState: intra("Rajasthan") }));
  assert.equal(lines[0].taxableValue, 952.38);
  assert.equal(lines[0].cgst, 23.81);
  assert.equal(lines[0].sgst, 23.81);
  assert.equal(lines[0].igst, 0);
  assert.equal(totals.grandTotal, 1000);
  assert.equal(totals.roundOff, 0);
});

t("non-Rajasthan address → IGST only", () => {
  const { lines, totals } = buildInvoice([item(1000)], opts({ intraState: intra("Maharashtra") }));
  assert.equal(lines[0].igst, 47.62);
  assert.equal(lines[0].cgst + lines[0].sgst, 0);
  assert.equal(totals.igst, 47.62);
  assert.equal(Math.round((totals.taxable + totals.tax) * 100), 100000);
});

t("odd paisa: SGST takes it, halves always add back to the tax", () => {
  assert.deepEqual(splitTax(5, true), { cgst: 2, sgst: 3, igst: 0 });
  assert.deepEqual(splitTax(5, false), { cgst: 0, sgst: 0, igst: 5 });
  const { lines } = buildInvoice([item(1)], opts());
  assert.equal(lines[0].taxableValue, 0.95);
  assert.equal(lines[0].cgst, 0.02);
  assert.equal(lines[0].sgst, 0.03);
});

t("inclusive back-calculation never loses a paisa (taxable + tax = price)", () => {
  for (let price = 1; price <= 5000; price += 7) {
    for (const rate of [0, 5, 12, 18]) {
      const { taxable, tax } = backCalculate(price * 100, rate);
      assert.equal(taxable + tax, price * 100);
      assert.ok(Math.abs(taxable - (price * 100 * 100) / (100 + rate)) <= 0.5);
    }
  }
});

t("discount is shared across items by value; totals still match the order total", () => {
  const { lines, totals } = buildInvoice([item(600), item(400, 1, 5, "Honey")], opts({ discount: 100 }));
  assert.equal(lines[0].discount, 60);
  assert.equal(lines[1].discount, 40);
  assert.equal(totals.grandTotal, 900);
  assert.equal(totals.discount, 100);
});

t("shipping + COD lines are separate and use the principal item rate", () => {
  const items = [item(500, 2, 5), item(200, 1, 12, "Other")];
  const rate = principalRate(items);
  assert.equal(rate, 5);
  const fees = [
    { kind: "shipping", title: "Shipping charges", size: "", sku: null, hsn: "996812", gstRate: rate, quantity: 1, unitPrice: 60 },
    { kind: "cod", title: "COD handling fee", size: "", sku: null, hsn: "996812", gstRate: rate, quantity: 1, unitPrice: 30 },
  ];
  const { lines, totals } = buildInvoice([...items, ...fees], opts({ discount: 50 }));
  assert.equal(lines[2].discount, 0);
  assert.equal(lines[3].discount, 0);
  assert.equal(lines[2].taxableValue, 57.14);
  assert.equal(totals.grandTotal, 1000 + 200 - 50 + 60 + 30);
});

t("exclusive prices add GST and round the grand total to the rupee", () => {
  const { totals } = buildInvoice([item(999, 1, 18)], opts({ pricesIncludeGst: false }));
  assert.equal(totals.tax, 179.82);
  assert.equal(totals.grandTotal, 1179);
  assert.equal(totals.roundOff, 0.18);
});

t("not GST registered → bill of supply, no tax", () => {
  const { totals, lines } = buildInvoice([item(1000)], opts({ gstRegistered: false }));
  assert.equal(totals.tax, 0);
  assert.equal(lines[0].gstRate, 0);
  assert.equal(totals.grandTotal, 1000);
});

t("credit note: partial refund is back-calculated per line; capped at the invoice", () => {
  const inv = buildInvoice([item(1000)], opts());
  const half = buildCreditLines(inv.lines, 500, { intraState: true });
  assert.equal(half.totals.grandTotal, 500);
  assert.equal(half.totals.taxable, 476.19);
  assert.equal(half.totals.tax, 23.81);
  const over = buildCreditLines(inv.lines, 5000, { intraState: true });
  assert.equal(over.totals.grandTotal, 1000);
  const multi = buildInvoice([item(600), item(400, 1, 12, "Honey")], opts({ intraState: false }));
  const credit = buildCreditLines(multi.lines, 333, { intraState: false });
  assert.equal(credit.lines.reduce((s, l) => s + Math.round(l.lineTotal * 100), 0), 33300);
});

t("HSN/GST precedence: product → per-product override → category", () => {
  assert.deepEqual(resolveTaxRule({ handle: "groundnut-oil", category: "oil", hsn: "15081000", gstRate: 12 }, taxConfig), { hsn: "15081000", gstRate: 12 });
  assert.deepEqual(resolveTaxRule({ handle: "groundnut-oil", category: "oil", hsn: null, gstRate: null }, taxConfig), { hsn: "1508", gstRate: 5 });
  assert.deepEqual(resolveTaxRule({ handle: "new-honey", category: "honey", hsn: null, gstRate: null }, taxConfig), { hsn: "0409", gstRate: 5 });
  assert.deepEqual(resolveTaxRule({ handle: "x", category: "unknown", hsn: null, gstRate: null }, taxConfig), { hsn: null, gstRate: null });
});

t("numbering + financial year (IST, April start)", () => {
  assert.equal(documentNumber("SMP", "2026-27", 123, 6), "SMP/2026-27/000123");
  assert.equal(documentNumber("SMP/CN", "2026-27", 45, 6), "SMP/CN/2026-27/000045");
  assert.equal(financialYearFor(new Date("2026-03-31T19:00:00Z")), "2026-27"); // 1 Apr 00:30 IST
  assert.equal(financialYearFor(new Date("2026-03-31T18:00:00Z")), "2025-26"); // 31 Mar 23:30 IST
});

t("amount in words, Indian grouping", () => {
  assert.equal(amountInWords(1000), "One thousand rupees only");
  assert.equal(amountInWords(125050), "One lakh twenty five thousand fifty rupees only");
  assert.equal(amountInWords(12345678), "One crore twenty three lakh forty five thousand six hundred seventy eight rupees only");
  assert.equal(amountInWords(1234.5), "One thousand two hundred thirty four rupees and fifty paise only");
  assert.equal(amountInWords(0), "Zero rupees only");
});

console.log(`\n${n} invoice maths tests passed`);
