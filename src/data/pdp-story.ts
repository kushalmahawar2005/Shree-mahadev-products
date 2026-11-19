/**
 * Storytelling content for the product page (below the buy box): method steps, at-home checks,
 * comparison art and the brand band. Copy is process/taste/tradition only (no health claims).
 *
 * Images: every `image` is optional. Missing ones render a clean icon panel, so a section never
 * shows a broken frame. Drop a new file at the listed path (prompts in docs/illustration-prompts.md,
 * "PDP" section) and set the field here.
 */
import type { ProductCategory } from "@/lib/commerce/types";
import { scenes, type Art } from "@/data/brand-art";
import { siteVideoUrl } from "@/lib/site-videos";

export type StoryStep = { title: string; body: string; image?: string };
export type HomeCheck = { title: string; body: string; icon: "smell" | "cold" | "look" | "pour" | "taste"; image?: string };
/** One reel: an uploaded video, or an Instagram Reel / YouTube Shorts link (optional cover image for Instagram). */
export type ReelClip = { video?: string; link?: string; cover?: string; caption: string };

export const CHECK_ICONS = ["smell", "cold", "look", "pour", "taste"] as const;

export type Story = {
  method?: { eyebrow: string; title: string; intro: string; steps: StoryStep[] };
  checks?: { eyebrow: string; title: string; intro: string; items: HomeCheck[] };
  reels?: ReelClip[];
};

const OIL: Story = {
  method: {
    eyebrow: "कच्ची घाणी की विधि",
    title: "The kachi ghani way. No shortcuts.",
    intro: "Six slow steps, the same way oil was made in village ghanis.",
    steps: [
      { title: "Farm sourced", body: "We start with whole, clean seeds from trusted farms.", image: "/illustrations/process/1-farm.webp" },
      { title: "Hand cleaned", body: "Stones, dust and husk are picked out before pressing.", image: "/illustrations/process/2-hand-cleaned.webp" },
      { title: "Wood pressed", body: "Kolhu wood pressed slowly in our kachi ghani, so the oil stays cool.", image: "/illustrations/process/3-wood-pressed.webp" },
      { title: "Cotton cloth filtered", body: "Filtered through pure cotton cloth to catch the seed bits.", image: "/illustrations/process/4-cloth-filtered.webp" },
      { title: "Gravity sedimentation", body: "Rested still for 10 days so the finest particles sink on their own.", image: "/illustrations/process/4b-gravity-settled.webp" },
      { title: "Bottled fresh", body: "Filled in food-grade PET bottles and sealed in small batches in Bijainagar.", image: "/illustrations/process/5-bottled.webp" },
    ],
  },
  checks: {
    eyebrow: "घर पर पहचानें",
    title: "Know real kachi ghani oil at home",
    intro: "Four simple checks. Unrefined oil behaves a little differently, and that's a good sign.",
    items: [
      { image: "/images/product-story/check-smell-v1.webp", icon: "smell", title: "Smell it", body: "Open the cap. Kachi ghani oil smells strongly of the seed it came from." },
      { image: "/images/product-story/check-cold-v1.webp", icon: "cold", title: "The fridge check", body: "Keep a little in the fridge. Unrefined oil may turn cloudy or thicken, and clears again at room temperature." },
      { image: "/images/product-story/check-sediment-v1.webp", icon: "look", title: "Look at the bottom", body: "A thin layer of natural sediment can settle in the bottle. It comes from the seed, not a defect." },
      { image: "/images/product-story/check-thick-v1.webp", icon: "pour", title: "Naturally thick, rich in texture", body: "Traditionally wood-pressed oil is thicker and richer than refined oil, because nothing is stripped out." },
    ],
  },
  reels: [
    { video: siteVideoUrl("reels/ghani-2"), caption: "Slow pressing, no heat" },
    { video: siteVideoUrl("reels/oil-pour"), caption: "Golden oil, straight from the press" },
    { video: siteVideoUrl("reels/ghani-3"), caption: "Settled, filtered, bottled by hand" },
    { video: siteVideoUrl("reels/bottling"), caption: "Filtered and filled, batch by batch" },
    { video: siteVideoUrl("reels/ghani-pour"), caption: "Golden oil from the ghani" },
    { video: siteVideoUrl("reels/ghani-1"), caption: "Seeds going into the ghani" },
  ],
};

const HONEY: Story = {
  checks: {
    eyebrow: "घर पर पहचानें",
    title: "Know raw honey at home",
    intro: "Raw honey is not processed to look the same in every jar.",
    items: [
      { icon: "cold", title: "It may crystallise", body: "In cold weather raw honey can turn grainy. Warm the jar in water and it turns liquid again." },
      { icon: "pour", title: "Slow, thick pour", body: "Raw honey pours slowly and folds over itself on the spoon." },
      { icon: "taste", title: "Taste the flower", body: "Each batch tastes of the flowers the bees visited, so it can vary a little." },
    ],
  },
};

// TODO(client): jaggery/khand method + checks once the client confirms how they are made.
const STORY: Partial<Record<ProductCategory, Story>> = { oil: OIL, honey: HONEY };

/** Built-in copy. The admin "Product stories" page can override it per category (settings key `pdp_story`). */
export const DEFAULT_STORIES = STORY;

export const storyFor = (category: ProductCategory): Story => STORY[category] ?? {};

/** Brand band painting per product (matched on the handle), falling back to mustard. */
const SCENES: [RegExp, Art][] = [
  [/mustard/, scenes.mustard],
  [/groundnut|peanut/, scenes.groundnut],
  [/coconut/, scenes.coconut],
  [/sesame|til/, scenes.sesame],
  [/almond|walnut|dry/, scenes.dryfruit],
  [/honey/, scenes.honey],
  [/jaggery|khand|gud|sugar/, scenes.jaggery],
  [/khal|cake/, scenes.oilcake],
];
export const sceneFor = (handle: string): Art => SCENES.find(([re]) => re.test(handle))?.[1] ?? scenes.mustard;
