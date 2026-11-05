/**
 * Homepage content below the hero. Layout follows twobrothersindiashop.com,
 * copy is ours. Anything not confirmed by the client is marked TODO(client).
 */

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
  // TODO(client): confirm the Rasoi Starter Kit contents and price before this goes live.
  line1: "Still cooking in refined oil?",
  line2: "Your nani never did.",
  cta: { label: "Make the switch", href: "/collections/combos" },
  tag: "Rasoi Starter Kit",
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
    text: "Pressed slowly in a wooden ghani. No heat, no chemicals, no refining. The oil settles naturally before bottling.",
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
