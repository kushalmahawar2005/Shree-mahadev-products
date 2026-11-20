// Pure-function tests (no DB, no network): safe to run anywhere, including CI.
// Run: pnpm test:units
import assert from "node:assert/strict";
import { toMobile10 } from "../src/lib/utils/phone.ts";
import { maxForLine, qtyLimit, bulkOrderHref } from "../src/lib/order-limits.ts";
import { packedWeightGrams, parcelFor, boxForWeight } from "../src/lib/packaging.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("✓", name);
};

/* ── Phone numbers ── */
t("phone: +91 / 0 / spaces / dashes → 10 digits", () => {
  assert.equal(toMobile10("+91 63678 28788"), "6367828788");
  assert.equal(toMobile10("+916367828788"), "6367828788");
  assert.equal(toMobile10("06367828788"), "6367828788");
  assert.equal(toMobile10("+91-91234-56789"), "9123456789");
});
t("phone: a real number starting with 91 is kept", () => {
  assert.equal(toMobile10("9123456789"), "9123456789");
});
t("phone: partial typing is not mangled", () => {
  assert.equal(toMobile10("91234"), "91234");
});

/* ── Order limits ── */
const oil = (ml) => ({ sizeValue: ml, sizeUnit: "ml" });
t("limits: 1 L oil bottles share one limit of 12 across oils", () => {
  const a = qtyLimit("groundnut-oil", oil(1000));
  const b = qtyLimit("yellow-mustard-oil", oil(1000));
  assert.equal(a.max, 12);
  assert.equal(a.key, b.key);
});
t("limits: jaggery 5, honey 4, unknown products fall back to 99", () => {
  assert.equal(qtyLimit("jaggery-powder", { sizeValue: 500, sizeUnit: "g" }).max, 5);
  assert.equal(qtyLimit("jamun-raw-honey", { sizeValue: 250, sizeUnit: "g" }).max, 4);
  const other = qtyLimit("some-new-product", { sizeValue: 100, sizeUnit: "g" });
  assert.equal(other.max, 99);
  assert.equal(other.client, false);
});
t("limits: room left on a line counts the other oils of the same size", () => {
  const lines = [
    { id: "a", quantity: 8, variant: { id: "v1", ...oil(1000) }, product: { handle: "groundnut-oil" } },
    { id: "b", quantity: 3, variant: { id: "v2", ...oil(1000) }, product: { handle: "coconut-oil" } },
  ];
  // Groundnut line may grow to 12 - 3 = 9 (the coconut bottles use part of the shared limit).
  assert.equal(maxForLine(lines, "groundnut-oil", { id: "v1", ...oil(1000) }, "a"), 9);
});
t("limits: bulk link drops the long title suffix", () => {
  const href = bulkOrderHref("Groundnut Oil, Wood-Pressed, Gravity-Filtered", "1 L", 12);
  assert.match(href, /product=Groundnut\+Oil&/);
  assert.match(href, /max=12$/);
});

/* ── Packaging ── */
t("packaging: 1 L oil uses the sheet weight with packaging", () => {
  assert.equal(packedWeightGrams("groundnut-oil", 1000, "ml", 1), 1140);
  assert.equal(packedWeightGrams("groundnut-oil", 1000, "ml", 3), 3420);
});
t("packaging: parcel of several bottles has a real box and total weight", () => {
  const p = parcelFor([{ handle: "groundnut-oil", sizeValue: 1000, sizeUnit: "ml", qty: 2 }]);
  assert.equal(p.grams, 2280);
  for (const d of [p.box.length, p.box.breadth, p.box.height]) assert.ok(Number.isInteger(d) && d > 0);
});
t("packaging: box grows with weight", () => {
  const small = boxForWeight(500);
  const big = boxForWeight(8000);
  assert.ok(big.length * big.breadth * big.height > small.length * small.breadth * small.height);
});

console.log(`\n${n} unit tests passed`);
