/**
 * Fallback FAQs per category for the product page. A product's own FAQs (admin) come first; these
 * fill the list up to five. Plain answers, no health claims.
 */
export type Faq = { q: string; a: string };

const OIL: Faq[] = [
  {
    q: "Why do the colour and smell feel stronger than supermarket oil?",
    a: "Because nothing is taken out. Refined oil is bleached and deodorised; ours is only wood-pressed, cloth-filtered and left to settle, so the seed's natural colour, aroma and taste stay in the bottle.",
  },
  {
    q: "Why are there a few particles at the bottom of the bottle?",
    a: "That is natural seed sediment. We let the oil settle for 10 days instead of filter-pressing it, so a little can still settle over time. It is safe; you can shake the bottle or leave it at the bottom.",
  },
  {
    q: "Is this oil hexane-free?",
    a: "Yes. The oil is pressed in a wooden kolhu (kachi ghani). No hexane or any other chemical solvent is used at any step.",
  },
  {
    q: "How should I store it?",
    a: "Keep the cap closed and store it in a cool, dry place away from direct sunlight. It is best used within 10 months of packaging.",
  },
  {
    q: "What if my order arrives damaged, leaking or expired?",
    a: "Please record a video while opening the parcel. If the product arrives damaged or expired, raise a request from My orders within 7 days with that unboxing video and we will replace it or refund you.",
  },
];

const HONEY: Faq[] = [
  {
    q: "Why has my honey turned solid?",
    a: "Raw honey naturally crystallises, especially in winter. It is a sign it has not been over-processed. Keep the jar in warm water for a few minutes and it turns liquid again.",
  },
  {
    q: "What does raw honey mean?",
    a: "It is honey as it comes from the hive, only strained to remove wax and bits. No sugar syrup is added and it is not refined like supermarket honey.",
  },
  {
    q: "How should I store it?",
    a: "Keep the lid tightly closed in a cool, dry place. There is no need to refrigerate. Always use a dry spoon so moisture does not get in.",
  },
  {
    q: "Can I give honey to babies?",
    a: "No. Do not give honey to children under 1 year of age.",
  },
  {
    q: "What if my order arrives damaged or expired?",
    a: "Please record a video while opening the parcel. If the product arrives damaged or expired, raise a request from My orders within 7 days with that unboxing video and we will replace it or refund you.",
  },
];

const SWEETENER: Faq[] = [
  {
    q: "How is this different from white sugar?",
    a: "It is made from sugarcane juice the traditional way, without chemical bleaching or refining, so it keeps its natural colour and taste.",
  },
  {
    q: "Why does the colour change a little from batch to batch?",
    a: "Each batch of sugarcane is a little different, and we do not add colour or bleach. A small change in colour is natural.",
  },
  {
    q: "How should I store it?",
    a: "Keep it in an airtight container in a cool, dry place. If it hardens with moisture, break it up; it is still fine to use.",
  },
  {
    q: "What if my order arrives damaged or expired?",
    a: "Please record a video while opening the parcel. If the product arrives damaged or expired, raise a request from My orders within 7 days with that unboxing video and we will replace it or refund you.",
  },
];

export function fallbackFaqs(category: string): Faq[] {
  return category === "oil" ? OIL : category === "honey" ? HONEY : SWEETENER;
}
