import type { Art } from "@/data/brand-art";

/** Original folk watercolours. PNG masters: output/imagegen/pdp-corners. */
const corner = (name: string): Art => ({
  src: `/images/product-story/corners/pdp-${name}-v1.webp`,
  width: 1600,
  height: 900,
});

export const pdpArt = {
  method: corner("method"),
  compare: corner("compare"),
  checks: corner("checks"),
  reviews: corner("reviews"),
  set: corner("set"),
  story: corner("story"),
};

export const pdpMustardScene: Art = {
  src: "/images/product-story/story-mustard-v1.webp",
  width: 1600,
  height: 1000,
};
