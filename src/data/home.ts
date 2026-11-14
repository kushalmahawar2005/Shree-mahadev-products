/**
 * Homepage content below the hero. Layout follows twobrothersindiashop.com,
 * copy is ours. Anything not confirmed by the client is marked TODO(client).
 */
import { scenes, stages } from "./brand-art";

export const topPicks = {
  title: "Top picks for you",
  tabs: [
    {
      label: "Most loved",
      source: { collection: "bestsellers" },
      viewAll: "/collections/bestsellers",
    },
    {
      label: "Cooking oils",
      source: { collection: "cooking-oils" },
      viewAll: "/collections/cooking-oils",
    },
    {
      label: "Wellness oils",
      source: { collection: "wellness-oils" },
      viewAll: "/collections/wellness-oils",
    },
    {
      label: "Raw honey",
      source: { collection: "raw-honey" },
      viewAll: "/collections/raw-honey",
    },
    {
      label: "Natural sweeteners",
      source: { collection: "natural-sweeteners" },
      viewAll: "/collections/natural-sweeteners",
    },
    {
      label: "Bulk tins",
      source: { collection: "bulk-tins" },
      viewAll: "/collections/bulk-tins",
    },
  ],
} as const;

export const promoStrip = {
  line1: "Still cooking in refined oil?",
  line2: "Your nani never did. Switch to oil pressed slow, with nothing taken out.",
  points: ["No heat", "No chemicals", "No refining"],
  cta: { label: "Shop kachi ghani oils", href: "/collections/wood-pressed-oils" },
  tag: "Kachi ghani · The old way",
};

export const brandFilm = {
  titleLead: "We Are Pressers,",
  titleRest: "Making Honest Oil the Slow Way",
  // TODO(client): paste the YouTube link (watch, youtu.be or shorts) of the ghani film. Empty = poster only.
  youtube: "",
  posterTitle: "From seed to bottle",
  posterSub: "A wooden ghani in Bijainagar, Rajasthan",
};

export const proofCards = [
  {
    seal: "Lab tested",
    sealSub: "Every batch",
    image: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735960/swadeshi-mahadev/static/images/deco/seal-lab-tested.webp",
    text: "Each oil is sent to an independent lab. You can read the reports for every product on our lab reports page.",
    href: "/lab-reports",
    // TODO(client): lab report PDFs per product
  },
  {
    seal: "FSSAI",
    sealSub: "Licensed",
    image: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793739929/swadeshi-mahadev/static/images/deco/seal-fssai.webp" as string | undefined, // FSSAI Lic. No. 12226047000007
    text: "We are licensed by the Food Safety and Standards Authority of India. Licence No. 12226047000007, printed on every label.",
    href: "/about",
  },
  {
    seal: "Kachi ghani",
    sealSub: "No heat",
    image: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735946/swadeshi-mahadev/static/images/deco/seal-kachi-ghani.webp",
    text: "Wood pressed slowly in a kolhu. No heat, no chemicals, no refining. The oil settles naturally before bottling.",
    href: "/our-ghani",
  },
];

export const concernTitle = "Shop By Use";

/** Spotlight: alternating product photo + coloured note card. Notes are product facts, not customer reviews. */
export const spotlight = [
  {
    handle: "yellow-mustard-oil",
    title: "Yellow Mustard Oil",
    text: "Sharp, clean and golden. The oil Rajasthan has made achaar and tadka with for generations.",
    note: "Best for pickles & tadka",
    color: "#0C3C24",
  },
  {
    handle: "groundnut-oil",
    title: "Groundnut Oil",
    text: "Light, nutty and steady at high heat. Our everyday oil for puri, pakode and sabzi.",
    note: "Best for daily cooking",
    color: "#5B3A1E",
  },
  {
    handle: "jamun-raw-honey",
    title: "Jamun Raw Honey",
    text: "Dark, slightly tangy honey from jamun blossoms. Raw and unheated, so it may crystallise. That is a good sign.",
    note: "Best with warm water",
    color: "#8A5A0B",
  },
  {
    handle: "black-sesame-oil",
    title: "Black Sesame Oil",
    text: "Deep, warm and rich. Traditionally used for winter malish and oil pulling.",
    note: "Best for massage",
    color: "#072F1B",
  },
  {
    handle: "flaxseed-oil",
    title: "Flaxseed Oil",
    text: "Pressed cold and bottled fresh. Drizzle it, never fry it.",
    note: "Best for salads & drizzling",
    color: "#9C6A2F",
  },
] as const;

/**
 * Real, verified customer words only. Keep empty until the client shares them.
 * Keyword-stuffed reviews ("best oil in Bijainagar…") must never go here.
 */
export const endorsements: {
  name: string;
  role: string;
  quote: string;
  avatar?: string;
}[] = [
  // TODO(client): 3–6 verified customer / chef / retailer quotes with permission + photo
];

export const beyondSlides = [
  {
    href: "/our-ghani",
    bold: "OUR",
    script: "Ghani",
    bg: "#5B3A1E",
    sub: "How we press, step by step",
  },
  {
    href: "/lab-reports",
    bold: "LAB",
    script: "Reports",
    bg: "#0C3C24",
    sub: "Read the test results",
  },
  {
    href: "/recipes",
    bold: "DESI",
    script: "Recipes",
    bg: "#8A5A0B",
    sub: "Cooked with kachi ghani oil",
  },
  {
    href: "/bulk-orders",
    bold: "BULK",
    script: "Orders",
    bg: "#072F1B",
    sub: "5L & 15L tins for kitchens",
  },
] as const;

/** Homepage "Shop by category": the client's categories (WhatsApp, 2026-11-05; hair oils hidden for now).
 *  `collection` = store collection handle; empty means no products yet → "Coming soon". */
export const categoryTiles = [
  {
    key: "oils", title: "Wood-Pressed oils", titleHi: "कच्ची-घाणी तेल", unit: "oils", collection: "wood-pressed-oils", span: "hero",
    blurb: "Mustard, groundnut, sesame, coconut and more, slow-pressed in our wooden ghani.",
    stage: stages.oils.src,
    cover: "/images/home/category-oils-v2.webp",
    // Solid edge tone lets the composed photo fade cleanly into the copy area.
    tone: { bg: "#06301b", ink: "light", glow: "none" },
  },
  {
    key: "honey", title: "Raw honey", titleHi: "कच्चा शहद", unit: "honeys", collection: "raw-honey", span: "wide",
    blurb: "Unheated, unfiltered honey from forest flowers.",
    scene: scenes.honey.src,
    cover: "/images/home/category-honey-v2.webp",
    tone: { bg: "linear-gradient(140deg,#f4d98a 0%,#d9a43a 100%)", ink: "dark", glow: "radial-gradient(circle,rgba(255,255,255,.7),transparent 65%)" },
  },
  {
    key: "jaggery", title: "Natural sweeteners", titleHi: "देसी मिठास", unit: "items", collection: "natural-sweeteners", span: "wide",
    blurb: "Jaggery powder, desi khand and blocks.",
    scene: scenes.jaggery.src,
    cover: "/images/home/category-sweeteners-v2.webp",
    tone: { bg: "linear-gradient(140deg,#7a4a1f 0%,#55310f 100%)", ink: "light", glow: "radial-gradient(circle,rgba(208,177,122,.55),transparent 65%)" },
  },
  {
    key: "seeds", title: "Seeds", titleHi: "बीज", unit: "seeds", collection: "", span: "wide",
    blurb: "The same clean seeds we press, for your kitchen.",
    scene: scenes.sesame.src,
    cover: "/images/home/category-seeds-v1.webp",
    tone: { bg: "#f6efe2", ink: "dark", glow: "none" },
  },
  {
    key: "cake", title: "Oil cake (khal)", titleHi: "खल", unit: "items", collection: "", span: "wide",
    blurb: "Nutritious oil cake for cattle and farms.",
    scene: scenes.oilcake.src,
    cover: "/images/home/category-khal-v1.webp",
    tone: { bg: "#51452c", ink: "light", glow: "none" },
  },
] as const;

/** Proof section: only documents issued to Mahadev Products (scans in /public/proof). */
export const proof = {
  fssaiNo: "12226047000007",
  fssaiValidTill: "13 May 2031",
  lab: "Jagdamba Laboratories, Jaipur",
  // TODO(client): groundnut oil report; jaggery/honey reports issued to Mahadev Products.
  reports: [
    { slug: "yellow-mustard-oil", name: "Yellow Mustard", reportNo: "JLFD260401144" },
    { slug: "black-mustard-oil", name: "Black Mustard", reportNo: "JLFD260401139" },
    { slug: "sesame-oil", name: "Sesame", reportNo: "JLFD260401140" },
    { slug: "black-sesame-oil", name: "Black Sesame", reportNo: "JLFD260611019" },
    { slug: "coconut-oil", name: "Coconut", reportNo: "JLFD260401141" },
    { slug: "flaxseed-oil", name: "Flaxseed", reportNo: "JLFD260611017" },
    { slug: "sunflower-oil", name: "Sunflower", reportNo: "JLFD260401138" },
    { slug: "almond-oil", name: "Almond", reportNo: "JLFD260401142" },
    { slug: "walnut-oil", name: "Walnut", reportNo: "JLFD260401143" },
    { slug: "castor-oil", name: "Castor", reportNo: "JLFD260611018" },
  ],
};
