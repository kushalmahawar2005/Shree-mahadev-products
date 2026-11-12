// Unit tests for src/lib/cart-math.ts (pure function). Run: pnpm test:cart-math
import assert from "node:assert/strict";
import { cartMath } from "../src/lib/cart-math.ts";

const base = { freeShippingThreshold: 999, shippingFee: 60 };
let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("✓", name);
};

t("empty cart: zero everything, no shipping, no next target", () => {
  const m = cartMath({ ...base, lines: [] });
  assert.equal(m.total, 0);
  assert.equal(m.shipping, 0);
  assert.equal(m.next, null);
});

t("below free shipping: flat fee, MRP savings, next target", () => {
  const m = cartMath({ ...base, lines: [{ price: 491, mrp: 599, qty: 1 }] });
  assert.equal(m.subtotal, 491);
  assert.equal(m.mrpSavings, 108);
  assert.equal(m.shipping, 60);
  assert.equal(m.total, 551);
  assert.deepEqual(m.next, { amount: 999, remaining: 508 });
  assert.equal(m.totalSavings, 108); // was 599 + 60
});

t("at the threshold: free shipping counts as savings", () => {
  const m = cartMath({ ...base, lines: [{ price: 500, mrp: 600, qty: 2 }] });
  assert.equal(m.freeShipping, true);
  assert.equal(m.shipping, 0);
  assert.equal(m.total, 1000);
  assert.equal(m.totalSavings, 260); // 1200 + 60 - 1000
  assert.equal(m.next, null);
});

t("coupon discount and coupon free shipping", () => {
  const m = cartMath({ ...base, lines: [{ price: 400, qty: 1 }], couponDiscount: 50, couponFreeShipping: true });
  assert.equal(m.couponDiscount, 50);
  assert.equal(m.shipping, 0);
  assert.equal(m.total, 350);
});

t("milestones: best reached one applies; next one is the target", () => {
  const milestones = [{ amount: 3000, value: 150 }, { amount: 4500, value: 300 }];
  const m = cartMath({ ...base, lines: [{ price: 1600, qty: 2 }], milestones });
  assert.equal(m.milestoneDiscount, 150);
  assert.equal(m.total, 3050);
  assert.deepEqual(m.next, { amount: 4500, remaining: 1300 });
});

t("no stacking: the bigger of coupon vs milestone wins", () => {
  const milestones = [{ amount: 3000, value: 150 }];
  const a = cartMath({ ...base, lines: [{ price: 3000, qty: 1 }], milestones, couponDiscount: 100 });
  assert.equal(a.milestoneDiscount, 150);
  assert.equal(a.couponDiscount, 0);
  const b = cartMath({ ...base, lines: [{ price: 3000, qty: 1 }], milestones, couponDiscount: 400 });
  assert.equal(b.milestoneDiscount, 0);
  assert.equal(b.couponDiscount, 400);
  const c = cartMath({ ...base, lines: [{ price: 3000, qty: 1 }], milestones, couponDiscount: 100, stackCoupon: true });
  assert.equal(c.milestoneDiscount + c.couponDiscount, 250);
});

t("prepaid % applies after discounts", () => {
  const m = cartMath({ ...base, lines: [{ price: 1000, qty: 1 }], couponDiscount: 100, prepaidPercent: 3 });
  assert.equal(m.prepaidDiscount, 27);
  assert.equal(m.total, 873);
});

console.log(`\n${n} cart-math tests passed`);
