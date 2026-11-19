import { FilterX, FlaskConicalOff, Hourglass, MapPin, Sprout, ThermometerSnowflake } from "@/components/icons/duo";
import type { DuoIcon } from "@/components/icons/duo";
import { ReflectionSweep } from "@/components/motion/ReflectionSweep";
import { Ticker } from "@/components/motion/Ticker";
import { getHeroSlides } from "@/lib/hero";
import { HeroCarousel } from "./HeroCarousel";

const trustPoints: [DuoIcon, string][] = [
  [MapPin, "Wood-pressed in Bijainagar, Rajasthan"],
  [ThermometerSnowflake, "No heat"],
  [FlaskConicalOff, "No chemicals"],
  [FilterX, "No refining"],
  [Hourglass, "Slow kachi ghani"],
  [Sprout, "Seed to bottle, for your family"],
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
        className="relative hidden overflow-hidden bg-forest py-2.5 md:block md:py-4"
        aria-label="What makes our oil different"
      >
        <ReflectionSweep />
        <Ticker
          items={trustPoints.map(([Icon, text]) => (
            <span key={text} className="inline-flex items-center gap-2 md:gap-2.5">
              <Icon className="size-4 shrink-0 text-mustard md:size-5" strokeWidth={1.75} aria-hidden />
              {text}
            </span>
          ))}
          duration={30}
          className="text-sm font-semibold text-white md:text-lg"
          separator={
            <svg viewBox="0 0 24 24" className="size-2.5 text-mustard/70" aria-hidden>
              <path fill="currentColor" d="M12 0c.6 6.3 5.7 11.4 12 12-6.3.6-11.4 5.7-12 12-.6-6.3-5.7-11.4-12-12C6.3 11.4 11.4 6.3 12 0Z" />
            </svg>
          }
        />
      </div>
    </>
  );
}
