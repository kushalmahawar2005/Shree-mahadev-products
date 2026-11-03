/**
 * Hero banner slides. Text lives inside the image (designed banners).
 * Desktop image: 1600 x 650. Mobile image (optional): 800 x 800 recommended.
 * TODO(client): replace the placeholder SVGs in /public/images with real banners.
 */
export type HeroSlide = {
  src: string;
  /** Optional portrait/square crop for phones. Falls back to `src`. */
  mobileSrc?: string;
  alt: string;
  href: string;
};

export const heroSlides: HeroSlide[] = [
  {
    src: "/images/hero-slide-1.svg",
    alt: "Rajasthan ki asli kachi ghani. Wood-pressed oils from Bijainagar.",
    href: "/collections/wood-pressed-oils",
  },
  {
    src: "/images/hero-slide-2.svg",
    alt: "From seed to bottle. How our wooden ghani works.",
    href: "/our-ghani",
  },
  {
    src: "/images/hero-slide-3.svg",
    alt: "Raw honey and natural sweeteners.",
    href: "/collections/raw-honey",
  },
];

export const HERO_WIDTH = 1600;
export const HERO_HEIGHT = 650;
