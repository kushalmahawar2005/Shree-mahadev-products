import type { Product } from "@/lib/commerce/types";

export type CollectionDef = {
  handle: string;
  title: string;
  description: string;
  match: (p: Product) => boolean;
};

const cookingOils = new Set([
  "groundnut-oil",
  "yellow-mustard-oil",
  "black-mustard-oil",
  "white-sesame-oil",
  "brown-sesame-oil",
  "coconut-oil",
  "sunflower-oil",
]);
const mostLoved = new Set(["groundnut-oil", "yellow-mustard-oil", "jamun-raw-honey", "black-mustard-oil", "flaxseed-oil"]);
const wellnessOils = new Set(["almond-oil", "walnut-oil", "flaxseed-oil", "castor-oil", "black-sesame-oil"]);

export const collectionDefs: CollectionDef[] = [
  {
    handle: "wood-pressed-oils",
    title: "Wood-Pressed Oils",
    description:
      "Kachi ghani oils, slowly pressed in a wooden ghani in Bijainagar. No heat, no chemicals, no refining.",
    match: (p) => p.category === "oil",
  },
  {
    handle: "raw-honey",
    title: "Raw Honey",
    description: "Raw, unheated honey. It may crystallise over time, which is natural.",
    match: (p) => p.category === "honey",
  },
  {
    handle: "natural-sweeteners",
    title: "Natural Sweeteners",
    description: "Desi khand and jaggery, the way our grandparents sweetened things.",
    match: (p) => p.category === "sweetener",
  },
  {
    handle: "cooking-oils",
    title: "Cooking Oils",
    description: "Groundnut, mustard, sesame, coconut and sunflower for the everyday rasoi.",
    match: (p) => cookingOils.has(p.handle),
  },
  {
    handle: "wellness-oils",
    title: "Wellness Oils",
    description: "Almond, walnut, flaxseed, castor and black sesame for hair, skin and daily wellness.",
    match: (p) => wellnessOils.has(p.handle),
  },
  {
    handle: "bulk-tins",
    title: "Bulk Tins (5L & 15L)",
    description: "Large tins for big families, restaurants and retailers.",
    match: (p) => p.variants.some((v) => v.sizeValue >= 5000),
  },
  {
    handle: "combos",
    title: "Combos & Rasoi Kits",
    // TODO(client): decide bundles (e.g. Rasoi Starter Kit: mustard 1L + groundnut 1L + sesame 500ml)
    description: "Bundles are coming soon. TODO(client): finalise combos.",
    match: () => false,
  },
  {
    handle: "bestsellers",
    title: "Bestsellers",
    description: "What our customers reorder most.",
    // Curated "Most loved" list. The "bestseller" tag only drives the card badge.
    match: (p) => mostLoved.has(p.handle),
  },
];

/** Planned combos shown on the home page until real bundles exist in Shopify. TODO(client) */
export const plannedCombos = [
  {
    title: "Rasoi Starter Kit",
    items: ["Yellow mustard oil 1L", "Groundnut oil 1L", "Sesame oil 500ml"],
    note: "TODO(client): price + confirm contents",
  },
  {
    title: "Winter Wellness Kit",
    items: ["Black sesame oil 250ml", "Almond oil 50ml", "Jamun honey 250g"],
    note: "TODO(client): price + confirm contents",
  },
];
