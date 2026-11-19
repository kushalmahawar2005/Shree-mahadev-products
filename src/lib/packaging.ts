/**
 * Shipping box + packed weight per pack, from the client's packaging sheets (2026-11-19).
 * Every unit ships in its own box (2 units = exactly double the weight, boxes side by side), so a parcel
 * is: weight = sum of the units' packed weights, box = the unit boxes laid out side by side.
 * Used for courier quotes (checkout, product-page pincode check) and to prefill "Book a shipment".
 * Box sizes are cm, weights are grams of one packed unit (product + bottle/jar + box).
 */
export type Box = { length: number; breadth: number; height: number };
type Pack = { h: number; w: number; l: number; grams: number };

/** Oils, by bottle size in ml (no 15 ml pack is sold). */
const OIL: Record<number, Pack> = {
  30: { h: 13, w: 6, l: 6, grams: 190 },
  50: { h: 15, w: 6, l: 6, grams: 230 },
  100: { h: 16, w: 7, l: 7, grams: 270 },
  250: { h: 20, w: 8, l: 8, grams: 420 },
  500: { h: 26, w: 8, l: 8, grams: 660 },
  1000: { h: 33, w: 9, l: 9, grams: 1140 },
  2000: { h: 39, w: 12, l: 12, grams: 2090 },
  5000: { h: 41, w: 16, l: 16, grams: 4840 },
  15000: { h: 35, w: 27, l: 27, grams: 14740 },
};

/** Desi khand / jaggery powder / jaggery jars, by grams. 1 kg block and 5 kg packs are not on the sheet yet. */
const JAGGERY: Record<number, Pack> = {
  200: { h: 12, w: 9.5, l: 9.5, grams: 382 },
  500: { h: 18, w: 12, l: 12, grams: 706 },
  800: { h: 21, w: 12, l: 12, grams: 999 },
};

/** Honey jars, by grams. */
const HONEY: Record<number, Pack> = {
  150: { h: 18, w: 11, l: 4, grams: 411 },
  250: { h: 22, w: 14, l: 14, grams: 544 },
  500: { h: 23, w: 14, l: 14, grams: 850 },
  1000: { h: 24, w: 14, l: 14, grams: 1440 },
};

/** Packing the sheets add on top of the product (bottle/jar + box), for sizes not on a sheet. */
const PACKING_G = 150;

function tableFor(handle: string, sizeUnit: "ml" | "g") {
  if (sizeUnit === "ml") return OIL;
  return handle.includes("honey") ? HONEY : JAGGERY;
}

function packFor(handle: string, sizeValue: number, sizeUnit: "ml" | "g"): Pack {
  const table = tableFor(handle, sizeUnit);
  const exact = table[sizeValue];
  if (exact) return exact;
  // Not on a sheet (e.g. 1 kg jaggery block, 5 kg khand): product weight + packing,
  // in the next box up (or the biggest box in that table).
  const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
  const up = table[sizes.find((s) => s >= sizeValue) ?? sizes[sizes.length - 1]];
  const content = sizeUnit === "ml" ? sizeValue * 0.92 : sizeValue;
  return { ...up, grams: Math.ceil(content + PACKING_G) };
}

export type PackLine = { handle: string; sizeValue: number; sizeUnit: "ml" | "g"; qty: number };

/** Shipping weight (g) for `qty` units of one pack. */
export function packedWeightGrams(handle: string, sizeValue: number, sizeUnit: "ml" | "g", qty: number) {
  return Math.ceil(packFor(handle, sizeValue, sizeUnit).grams * qty);
}

/** Couriers take whole centimetres; round up so the box is never declared smaller than it is. */
const r1 = (n: number) => Math.ceil(n);

/**
 * Whole parcel for an order. One kind of pack: the unit boxes in a near-square grid
 * (2 × 1 L = 33 × 9 × 18, matching the sheet). Mixed packs: tallest box for height, the floor area of
 * all boxes as a square. Either way the courier's volumetric weight stays at or below the real weight.
 */
export function parcelFor(lines: PackLine[]): { grams: number; box: Box } {
  const units = lines.filter((l) => l.qty > 0).map((l) => ({ pack: packFor(l.handle, l.sizeValue, l.sizeUnit), qty: l.qty }));
  const grams = Math.max(50, Math.ceil(units.reduce((s, u) => s + u.pack.grams * u.qty, 0)));
  if (!units.length) return { grams, box: { length: 20, breadth: 15, height: 15 } };

  const same = units.every((u) => u.pack === units[0].pack);
  if (same) {
    const { h, w, l } = units[0].pack;
    const n = units.reduce((s, u) => s + u.qty, 0);
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return { grams, box: { length: r1(l * cols), breadth: r1(w * rows), height: r1(h) } };
  }
  const height = Math.max(...units.map((u) => u.pack.h));
  const side = Math.sqrt(units.reduce((s, u) => s + u.pack.w * u.pack.l * u.qty, 0));
  return { grams, box: { length: r1(side), breadth: r1(side), height: r1(height) } };
}

/** Fallback when only a weight is known (no items): a box from the oil sheet that weighs at least that much. */
export function boxForWeight(grams: number): Box {
  const p = Object.values(OIL).find((x) => x.grams >= grams) ?? OIL[15000];
  return { length: p.l, breadth: p.w, height: p.h };
}
