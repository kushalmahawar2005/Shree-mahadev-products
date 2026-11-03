import { Ticker } from "@/components/motion/Ticker";
import { heroSlides } from "@/data/hero";
import { HeroCarousel } from "./HeroCarousel";

const trustPoints = [
  "Wood-pressed in Bijainagar, Rajasthan",
  "No heat",
  "No chemicals",
  "No refining",
  "Slow kachi ghani",
  "Seed to bottle, one family",
];

/** Full-width banner carousel (1600 x 650), then a trust ticker. */
export function Hero() {
  return (
    <>
      <section>
        <HeroCarousel slides={heroSlides} />
      </section>

      <div
        className="border-b border-line bg-white py-4"
        aria-label="What makes our oil different"
      >
        <Ticker
          items={trustPoints}
          duration={30}
          className="text-lg font-semibold text-forest-text"
          separator={
            <span className="inline-block size-2 rounded-full bg-mustard" />
          }
        />
      </div>
    </>
  );
}
