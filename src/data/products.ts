import type { Product, ProductCategory, ProductVariant } from "@/lib/commerce/types";

/**
 * Mock catalog. Prices from the old live site (Nov 2026): price = sale, compareAtPrice = MRP.
 * TBD prices are 0 with availableForSale: false. TODO(client): confirm all TBD prices + final size list.
 *
 * Rule: one product = one oil/honey. Size = variant.
 */

type SizeSpec = [size: string, price: number | null, mrp: number | null];

function parseSize(size: string): { value: number; unit: "ml" | "g"; title: string } {
  const m = size.match(/^(\d+(?:\.\d+)?)\s*(ml|l|g|kg)$/i);
  if (!m) throw new Error(`Bad size: ${size}`);
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "l") return { value: n * 1000, unit: "ml", title: `${n} L` };
  if (u === "kg") return { value: n * 1000, unit: "g", title: `${n} kg` };
  return { value: n, unit: u as "ml" | "g", title: `${n} ${u}` };
}

function variants(handle: string, specs: SizeSpec[]): ProductVariant[] {
  return specs.map(([size, price, mrp]) => {
    const s = parseSize(size);
    const known = price !== null && price > 0;
    return {
      id: `${handle}--${size.toLowerCase()}`,
      title: s.title,
      sizeValue: s.value,
      sizeUnit: s.unit,
      price: { amount: known ? price : 0, currencyCode: "INR" },
      compareAtPrice: known && mrp ? { amount: mrp, currencyCode: "INR" } : undefined,
      availableForSale: known,
      sku: `SMP-${handle.toUpperCase().slice(0, 12)}-${size.toUpperCase()}`,
    };
  });
}

type Input = Omit<Product, "id" | "variants" | "priceRange" | "images" | "seo" | "descriptionHtml"> & {
  sizes: SizeSpec[];
  description: string;
};

// Mock ratings are only shown in development. Real numbers come from Judge.me.
const showMockReviews = process.env.NODE_ENV !== "production";

function product(p: Input): Product {
  const vs = variants(p.handle, p.sizes);
  const priced = vs.filter((v) => v.availableForSale).map((v) => v.price.amount);
  const min = priced.length ? Math.min(...priced) : 0;
  const max = priced.length ? Math.max(...priced) : 0;
  const { sizes: _sizes, description, ...rest } = p;
  void _sizes;
  return {
    ...rest,
    id: `gid://mock/Product/${p.handle}`,
    descriptionHtml: description
      .split("\n\n")
      .map((para) => `<p>${para}</p>`)
      .join(""),
    images: [
      {
        url: `/images/placeholder-${p.handle}.svg`,
        alt: `${p.title} (${p.titleHi}) bottle`,
        width: 800,
        height: 800,
      },
    ],
    variants: vs,
    priceRange: {
      min: { amount: min, currencyCode: "INR" },
      max: { amount: max, currencyCode: "INR" },
    },
    rating: showMockReviews ? p.rating : undefined,
    reviewCount: showMockReviews ? p.reviewCount : undefined,
    seo: {
      title: `${p.title} (${p.titleHi})`,
      description: p.shortDescription,
    },
  };
}

const oilProcess =
  "Seeds are cleaned, sun-dried and slowly crushed in a wooden (kachi ghani) press in Bijainagar. The oil settles naturally before it is filtered through cloth and bottled. No heat, no chemicals, no refining. TODO(client): seed sourcing details for this oil.";

const oilFaqs = (name: string) => [
  {
    q: `Why does ${name.toLowerCase()} look cloudy sometimes?`,
    a: "Unrefined oil can carry fine natural sediment and may thicken in cold weather. That is normal and a sign it has not been chemically processed.",
  },
  {
    q: "Is it wood-pressed or cold-pressed?",
    a: "It is pressed in a traditional wooden ghani (kachi ghani). The slow press keeps the temperature low, so no external heat is used.",
  },
];

const oilBase = (category: ProductCategory = "oil") => ({
  category,
  processNote: oilProcess,
  shelfLife:
    "Best within 9 months of manufacture. Store in a cool, dry place away from sunlight. TODO(client): confirm shelf life.",
});

export const products: Product[] = [
  product({
    ...oilBase(),
    handle: "groundnut-oil",
    title: "Wood-Pressed Groundnut Oil",
    titleHi: "मूंगफली तेल",
    swatch: "#D9B45A",
    shortDescription: "Nutty, everyday cooking oil from slow-pressed groundnuts.",
    processNote: undefined, // the client's About copy below already covers the process
    description:
      "<p>Our Wood Pressed Groundnut Oil is made from desi groundnuts sourced directly from farmers. After shelling, kernels are hand-cleaned and slowly extracted using a traditional Kolhu wood-pressed machine. The oil is cloth-filtered and left for natural gravity sedimentation for 10 days, allowing heavier particles to settle without aggressive filtration or chemical processing, helping retain its natural goodness.</p><p>With its rich aroma and nutty flavour, it's perfect for frying, roasting and everyday cooking.</p><p><strong>No additives. No preservatives. No Hexane. No chemicals.</strong></p><p><strong>Best Before:</strong> 12 months from packaging.</p>",
    benefits: [
      "Natural nutty aroma and taste",
      "High smoke point, good for frying",
      "Unrefined: no bleaching or deodorising",
      "Pressed without external heat",
    ],
    bestFor: ["Daily cooking", "Deep frying", "Namkeen & snacks"],
    howToUse: "Use like any cooking oil for sabzi, dal tadka, puri and pakode.",
    sizes: [
      ["1L", null, null],
      ["2L", 930, 1158],
      ["5L", 2250, 2730],
      ["15L", 5965, 7560],
    ],
    rating: 4.8,
    reviewCount: 46,
    tags: ["bestseller", "cooking", "daily-cooking", "deep-frying", "bulk"],
    faqs: oilFaqs("Groundnut oil"),
  }),
  product({
    ...oilBase(),
    handle: "yellow-mustard-oil",
    title: "Wood-Pressed Yellow Mustard Oil",
    titleHi: "पीली सरसों तेल",
    swatch: "#E0A526",
    shortDescription: "Milder mustard oil with a clean, sharp finish.",
    description:
      "Pressed from yellow mustard seeds in a wooden ghani. Milder than black mustard oil, with the familiar sarson ki jhaal that North Indian kitchens love.",
    benefits: [
      "Classic mustard pungency, slightly milder",
      "Good for tadka, pickles and sabzi",
      "Traditionally used for body massage",
      "Unrefined and chemical-free",
    ],
    bestFor: ["Tadka", "Pickles", "Daily cooking", "Massage"],
    howToUse: "Heat until it just begins to smoke, then cool slightly before adding spices.",
    sizes: [
      ["500ml", 345, 450],
      ["1L", 572, 704],
      ["2L", 1080, 1354],
      ["5L", 2525, 3080],
      ["15L", 7133, 9078],
    ],
    rating: 4.7,
    reviewCount: 38,
    tags: ["cooking", "daily-cooking", "pickles-tadka", "hair-skin", "bulk"],
    faqs: oilFaqs("Yellow mustard oil"),
  }),
  product({
    ...oilBase(),
    handle: "black-mustard-oil",
    title: "Wood-Pressed Black Mustard Oil",
    titleHi: "काली सरसों तेल",
    swatch: "#B5741E",
    shortDescription: "Strong, pungent kachi ghani sarson oil.",
    description:
      "The sharp, eye-watering kachi ghani sarson ka tel. Pressed from black mustard seeds for maximum flavour.",
    benefits: [
      "Strong natural pungency",
      "Ideal for achaar and Bengali-style cooking",
      "Traditional choice for winter massage",
      "No added flavour or colour",
    ],
    bestFor: ["Pickles", "Tadka", "Massage"],
    howToUse: "Heat to smoking point before cooking to mellow the raw pungency.",
    sizes: [
      ["100ml", 151, 157],
      ["250ml", 215, 241],
      ["1L", null, null],
      ["2L", 974, 1214],
    ],
    rating: 4.6,
    reviewCount: 21,
    tags: ["cooking", "pickles-tadka", "hair-skin", "baby-massage"],
    faqs: oilFaqs("Black mustard oil"),
  }),
  product({
    ...oilBase(),
    handle: "black-sesame-oil",
    title: "Wood-Pressed Black Sesame Oil",
    titleHi: "काले तिल का तेल",
    swatch: "#5B3A1E",
    shortDescription: "Rich, dark til oil for massage and wellness.",
    description:
      "Pressed from black til. Deep in colour and aroma. Traditionally used for oil pulling, abhyanga and hair care.",
    benefits: [
      "Traditionally used for abhyanga (self-massage)",
      "Popular for hair and scalp care",
      "Used for oil pulling",
      "Unrefined, nothing added",
    ],
    bestFor: ["Massage", "Hair care", "Oil pulling"],
    howToUse: "Warm slightly and massage into skin or scalp. Leave on for 30 minutes before bathing.",
    sizes: [
      ["50ml", 194, 213],
      ["250ml", 383, 459],
      ["500ml", 626, 775],
    ],
    rating: 4.8,
    reviewCount: 17,
    tags: ["wellness", "hair-skin", "baby-massage"],
    faqs: oilFaqs("Black sesame oil"),
  }),
  product({
    ...oilBase(),
    handle: "white-sesame-oil",
    title: "Wood-Pressed White Sesame Oil",
    titleHi: "सफ़ेद तिल का तेल",
    swatch: "#E3C27A",
    shortDescription: "Light til oil for cooking and South Indian dishes.",
    description: "Light, golden til oil pressed from white sesame seeds. TODO(client): product story.",
    benefits: ["Light, mild til flavour", "Good for cooking and dressings", "Unrefined"],
    bestFor: ["Daily cooking", "Chutneys", "Massage"],
    // TODO(client): final sizes + prices
    sizes: [
      ["500ml", null, null],
      ["1L", null, null],
    ],
    tags: ["cooking", "daily-cooking"],
    faqs: oilFaqs("White sesame oil"),
  }),
  product({
    ...oilBase(),
    handle: "brown-sesame-oil",
    title: "Wood-Pressed Brown Sesame Oil",
    titleHi: "भूरे तिल का तेल",
    swatch: "#9C6A2F",
    shortDescription: "Everyday til oil with a toasty aroma.",
    description: "Pressed from brown sesame seeds. TODO(client): product story.",
    benefits: ["Toasty til aroma", "Suited to cooking and massage", "Unrefined"],
    bestFor: ["Daily cooking", "Massage"],
    sizes: [
      ["500ml", null, null],
      ["1L", null, null],
    ],
    tags: ["cooking", "daily-cooking", "hair-skin"],
    faqs: oilFaqs("Brown sesame oil"),
  }),
  product({
    ...oilBase(),
    handle: "flaxseed-oil",
    title: "Wood-Pressed Flaxseed Oil",
    titleHi: "अलसी का तेल",
    swatch: "#C9952E",
    shortDescription: "Alsi oil, a plant source of omega-3. Use raw, not for frying.",
    description:
      "Pressed from alsi (flaxseed). Best used raw: drizzle on salads, raita or roti. Do not heat.",
    benefits: [
      "Plant source of omega-3 (ALA)",
      "Nutty, slightly earthy taste",
      "Best consumed raw",
    ],
    bestFor: ["Salads", "Drizzling", "Wellness"],
    howToUse: "Take 1 teaspoon a day, or drizzle over food after cooking. Refrigerate after opening.",
    shelfLife: "Best within 3 months of opening. Refrigerate after opening. TODO(client): confirm.",
    sizes: [
      ["100ml", 218, 288],
      ["250ml", 356, 423],
      ["500ml", 545, 670],
      ["1L", 924, 1162],
    ],
    rating: 4.6,
    reviewCount: 12,
    tags: ["wellness"],
    faqs: oilFaqs("Flaxseed oil"),
  }),
  product({
    ...oilBase(),
    handle: "coconut-oil",
    title: "Wood-Pressed Coconut Oil",
    titleHi: "नारियल तेल",
    swatch: "#EDE6D3",
    shortDescription: "Pure nariyal tel for cooking, hair and skin.",
    description: "Pressed from dried coconut (copra). TODO(client): product story.",
    benefits: ["Mild coconut aroma", "For cooking, hair and skin", "Solidifies in winter (normal)"],
    bestFor: ["Daily cooking", "Hair care", "Baby massage"],
    sizes: [
      ["500ml", null, null],
      ["1L", null, null],
    ],
    tags: ["cooking", "daily-cooking", "hair-skin", "baby-massage"],
    faqs: oilFaqs("Coconut oil"),
  }),
  product({
    ...oilBase(),
    handle: "sunflower-oil",
    title: "Wood-Pressed Sunflower Oil",
    titleHi: "सूरजमुखी तेल",
    swatch: "#F1C232",
    shortDescription: "Light, neutral oil for everyday cooking.",
    description: "Pressed from sunflower seeds. TODO(client): product story.",
    benefits: ["Light and neutral taste", "Good for everyday cooking", "Unrefined"],
    bestFor: ["Daily cooking", "Baking"],
    sizes: [
      ["1L", null, null],
      ["5L", null, null],
    ],
    tags: ["cooking", "daily-cooking"],
    faqs: oilFaqs("Sunflower oil"),
  }),
  product({
    ...oilBase(),
    handle: "almond-oil",
    // TODO(client): confirm almond process. Named "Cold-Pressed" per old site until confirmed.
    title: "Cold-Pressed Almond Oil",
    titleHi: "बादाम तेल",
    swatch: "#E8CF8A",
    shortDescription: "Badam rogan for hair, skin and baby massage.",
    description:
      "Pressed from almonds. Light and non-sticky. Used for hair, skin, and traditionally a few drops in warm milk.",
    benefits: [
      "Light, non-sticky texture",
      "Popular for baby massage",
      "Used for hair and skin care",
    ],
    bestFor: ["Baby massage", "Hair care", "Skin care"],
    howToUse: "Massage a few drops into skin or scalp.",
    sizes: [
      ["30ml", 248, 283],
      ["50ml", 318, 375],
      ["1L", 3898, 5028],
    ],
    rating: 4.9,
    reviewCount: 14,
    tags: ["wellness", "hair-skin", "baby-massage"],
    faqs: oilFaqs("Almond oil"),
  }),
  product({
    ...oilBase(),
    handle: "walnut-oil",
    title: "Wood-Pressed Walnut Oil",
    titleHi: "अखरोट तेल",
    swatch: "#A8763E",
    shortDescription: "Akhrot oil for wellness and skin care.",
    description: "Pressed from walnuts. TODO(client): product story.",
    benefits: ["Rich, nutty aroma", "Used for skin and hair care"],
    bestFor: ["Wellness", "Skin care"],
    sizes: [
      ["100ml", null, null],
      ["250ml", null, null],
    ],
    tags: ["wellness", "hair-skin"],
    faqs: oilFaqs("Walnut oil"),
  }),
  product({
    ...oilBase(),
    handle: "castor-oil",
    title: "Wood-Pressed Castor Oil",
    titleHi: "अरंडी तेल",
    swatch: "#D8C79A",
    shortDescription: "Thick arandi oil for hair and external use.",
    description: "Pressed from castor seeds. For external use. TODO(client): product story.",
    benefits: ["Thick, rich texture", "Traditionally used for hair and brows", "For external use"],
    bestFor: ["Hair care", "Skin care"],
    sizes: [
      ["100ml", null, null],
      ["250ml", null, null],
    ],
    tags: ["wellness", "hair-skin"],
    faqs: oilFaqs("Castor oil"),
  }),

  // ── Raw honey ──
  product({
    handle: "jamun-raw-honey",
    category: "honey",
    title: "Jamun Raw Honey",
    titleHi: "जामुन शहद",
    swatch: "#5B2E2A",
    shortDescription: "Dark, slightly tangy honey from jamun blossoms.",
    description:
      "Raw, unprocessed honey from bees that forage on jamun (Indian blackberry) blossoms. Dark in colour with a light tang.\n\nRaw honey can crystallise over time. That is natural. Place the jar in warm water to soften it.",
    benefits: ["Raw and unheated", "Distinct dark, tangy flavour", "Crystallises naturally"],
    bestFor: ["Warm water in the morning", "Tea", "Desserts"],
    howToUse: "Take with warm (not hot) water, or use on toast and desserts. Do not cook at high heat.",
    processNote: "TODO(client): honey sourcing story (region, beekeepers, how it is filtered).",
    shelfLife: "Honey keeps for a long time. Store tightly closed, away from moisture. TODO(client): confirm.",
    sizes: [
      ["150g", 247, 282],
      ["250g", 312, 367],
      ["500g", 490, 598],
      ["1kg", 843, 1018],
    ],
    rating: 4.7,
    reviewCount: 19,
    tags: ["honey"],
    faqs: [
      {
        q: "Why has my honey turned solid?",
        a: "Raw honey crystallises naturally over time, especially in winter. Stand the jar in warm water to bring it back.",
      },
    ],
  }),
  product({
    handle: "sunderban-raw-honey",
    category: "honey",
    title: "Sunderban Raw Honey",
    titleHi: "सुंदरबन शहद",
    swatch: "#B97A1E",
    shortDescription: "Wild honey from the Sunderban mangroves.",
    description: "Raw honey from the Sunderban mangrove forests. TODO(client): sourcing story.",
    benefits: ["Raw and unheated", "Wild forest honey"],
    bestFor: ["Warm water", "Tea"],
    sizes: [
      ["150g", 247, 282],
      ["250g", null, null],
      ["500g", null, null],
    ],
    tags: ["honey"],
  }),
  product({
    handle: "van-tulsi-raw-honey",
    category: "honey",
    title: "Van Tulsi Raw Honey",
    titleHi: "वन तुलसी शहद",
    swatch: "#C9A13B",
    shortDescription: "Raw honey from tulsi-rich forest areas.",
    description: "Raw honey from areas rich in van tulsi. TODO(client): sourcing story.",
    benefits: ["Raw and unheated", "Herbal notes"],
    bestFor: ["Warm water", "Tea"],
    sizes: [
      ["250g", null, null],
      ["500g", null, null],
    ],
    tags: ["honey"],
  }),

  // ── Natural sweeteners ──
  product({
    handle: "desi-khand",
    category: "sweetener",
    title: "Desi Khand",
    titleHi: "देसी खांड",
    swatch: "#C89B5A",
    shortDescription: "Unrefined sugarcane sweetener, the old-fashioned way.",
    description: "Traditional unrefined khand made from sugarcane juice. TODO(client): product story.",
    benefits: ["Unrefined, no bleaching", "Mild caramel taste"],
    bestFor: ["Tea", "Desserts", "Daily use"],
    sizes: [
      ["500g", null, null],
      ["1kg", null, null],
    ],
    tags: ["sweetener"],
  }),
  product({
    handle: "jaggery-powder",
    category: "sweetener",
    title: "Jaggery Powder",
    titleHi: "गुड़ पाउडर",
    swatch: "#8E5A24",
    shortDescription: "Easy-to-use gud powder for tea and sweets.",
    description: "Powdered jaggery (gud) made from sugarcane. TODO(client): product story.",
    benefits: ["Dissolves easily", "Earthy, molasses taste"],
    bestFor: ["Tea", "Laddoo", "Desserts"],
    sizes: [
      ["500g", null, null],
      ["1kg", null, null],
    ],
    tags: ["sweetener"],
  }),
];

/** Products shown on the oil shelf, in shelf order. */
export const oilShelfOrder = [
  "groundnut-oil",
  "yellow-mustard-oil",
  "black-mustard-oil",
  "coconut-oil",
  "white-sesame-oil",
  "brown-sesame-oil",
  "black-sesame-oil",
  "flaxseed-oil",
  "sunflower-oil",
  "almond-oil",
  "walnut-oil",
  "castor-oil",
];
