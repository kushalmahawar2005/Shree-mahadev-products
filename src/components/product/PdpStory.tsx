import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Droplets, Eye, Flower2, Snowflake, Wind } from "lucide-react";
import { SectionHeader, sectionClass } from "@/components/ui/SectionHeader";
import { Reveal } from "@/components/motion/Reveal";
import type { HomeCheck } from "@/data/pdp-story";
import type { Art } from "@/data/brand-art";
import { cn } from "@/lib/utils/cn";
import { SectionArt } from "@/components/ui/SectionArt";

const CHECK_ICON = { smell: Wind, cold: Snowflake, look: Eye, pour: Droplets, taste: Flower2 } as const;

/** "Know it at home": three simple checks. Shows the painting when one is set, else a calm icon panel. */
export function HomeChecks({ eyebrow, title, intro, items }: { eyebrow: string; title: string; intro: string; items: HomeCheck[] }) {
  return (
    <section className={sectionClass} aria-labelledby="checks-h">
      <SectionHeader id="checks-h" eyebrow={eyebrow} title={title} subtitle={intro} />
      <Reveal>
        {/* Phones: one card per row (photo beside the full text). md+: three across. */}
        <ul className={cn("grid grid-cols-1 gap-3 md:gap-4", items.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
          {items.map((c, i) => {
            const Icon = CHECK_ICON[c.icon];
            return (
              <li key={c.title} className="flex overflow-hidden rounded-2xl border border-line bg-surface md:block md:rounded-3xl">
                <div className="relative aspect-square w-28 shrink-0 bg-co-brand-soft md:aspect-[4/3] md:w-auto">
                  {c.image ? (
                    <Image src={c.image} alt="" fill sizes="(min-width: 768px) 400px, 33vw" className="object-cover" />
                  ) : (
                    // TODO(art): check-* paintings (docs/illustration-prompts.md, "Home checks").
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-14 place-items-center rounded-full md:size-24 bg-surface shadow-[0_10px_30px_-18px_rgba(7,47,27,0.5)]">
                        <Icon className="size-6 text-forest md:size-10" strokeWidth={1.5} />
                      </span>
                    </span>
                  )}
                  <span className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-co-accent text-[11px] font-bold md:top-3 md:left-3 md:size-8 md:text-sm text-ink tabular-nums">{i + 1}</span>
                </div>
                <div className="min-w-0 self-center p-3 md:p-5">
                  <p className="text-[15px] leading-tight font-semibold text-ink md:text-base">{c.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-ink-muted md:text-sm md:leading-relaxed">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

/** Closing brand band: our story on deep forest, with the product standing in its painted scene. */
export function StoryBand({ isOil = true }: { isOil?: boolean }) {
  return (
    <section className={sectionClass} aria-label="Our story">
      <Reveal>
        <div className="relative isolate grid overflow-hidden rounded-[28px] border border-line bg-[#fff9ec] text-forest shadow-[0_16px_48px_-32px_rgba(14,59,38,.5)] lg:grid-cols-[1fr_1.1fr]">
          <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
            <p className="font-hindi text-lg text-[#865916]" lang="hi">
              हमारी कहानी
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-ink-muted">Bijainagar, Rajasthan · Family run</p>
            <h2 className="max-w-md text-[30px] leading-[1.12] tracking-[-0.025em] text-forest sm:text-[40px]">{isOil ? <>From our ghani<br />to your kitchen.</> : <>From our family<br />to yours.</>}</h2>
            <p className={cn("max-w-md leading-relaxed text-ink-muted", isOil ? "font-hindi text-base" : "text-[15px]")} lang={isOil ? "hi" : undefined}>
              {isOil ? "आज के केमिकल और रिफाइंड तेलों के युग में, हम आपको वापस ले आते हैं एक ऐसे सफर पर जहां प्रकृति की सच्चाई और गांव की मिट्टी की सुगंध महसूस होती है।" : "Everyday essentials, thoughtfully chosen by our family in Bijainagar, Rajasthan. Simple ingredients, carefully packed for your home."}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4"><Link
              href="/our-ghani"
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
            >
              Read our story <ArrowRight className="size-4" />
            </Link><Link href="/lab-reports" className="inline-flex items-center gap-1 text-sm font-semibold text-forest underline decoration-mustard underline-offset-4 hover:decoration-forest">View lab reports <ArrowRight className="size-4" aria-hidden="true" /></Link></div>
          </div>
          <div className="relative order-1 m-3 min-h-[230px] overflow-hidden rounded-2xl sm:min-h-[320px] lg:m-4 lg:min-h-[360px]">
            {/* Same family photo on every product page (Dadi beside the kachi ghani). */}
            <Image src="/images/product-story/dadi-working.png" alt="Illustration of Dadi sorting mustard seeds beside the kachi ghani" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/**
 * PDP band colours: each section gets its own calm tint (brand colours at low strength) and one
 * hand-painted ornament in a corner, so the page has rhythm without heavy textures.
 */
export const BAND = {
  ivory: "#FBF8F2",
  green: "#E7F0E5", // forest at ~10%
  mustard: "#FBF0D2", // mustard at ~15%
  forest: "#0E3B26", // dark feature band (reels)
} as const;

export function Band({
  tone,
  art,
  artClass = "top-4 right-0 w-[88px] opacity-90 sm:w-[140px] md:top-5 md:right-4 md:w-[280px]",
  children,
}: {
  tone: keyof typeof BAND;
  /** Original transparent corner ornament, kept clear of the section heading. */
  art?: Art;
  artClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={{ background: BAND[tone] }}>
      {art && <SectionArt art={art} className={artClass} drift={0} sizes="(min-width: 768px) 280px, (min-width: 640px) 140px, 88px" />}
      <div className={cn("relative", // Keep the eyebrow + title clear of the ornament; the subtitle can run full width.
        art && "[&_[data-slot=section-header]_h2]:pr-16 [&_[data-slot=section-header]_p:first-child]:pr-16 sm:[&_[data-slot=section-header]_h2]:pr-24 md:[&_[data-slot=section-header]]:pr-56")}>{children}</div>
    </div>
  );
}
