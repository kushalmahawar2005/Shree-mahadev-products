import { ReflectionSweep } from "@/components/motion/ReflectionSweep";
import { Ticker } from "@/components/motion/Ticker";
import { getHeroSlides } from "@/lib/hero";
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
export async function Hero() {
  const slides = await getHeroSlides();
  return (
    <>
      <section>
        <HeroCarousel slides={slides} />
      </section>

      <div
        className="relative overflow-hidden bg-forest py-4"
        aria-label="What makes our oil different"
      >
        <ReflectionSweep />
        <Ticker
          items={trustPoints}
          duration={30}
          className="text-lg font-semibold text-white"
          separator={
            <span className="inline-block size-2 rounded-full bg-mustard" />
          }
        />
      </div>
    </>
  );
}
