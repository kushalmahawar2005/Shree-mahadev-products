import Image from "next/image";
import Link from "next/link";
import { SpotlightStage } from "./SpotlightStage";
import { ArrowRight, Check } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ReflectionSweep } from "@/components/motion/ReflectionSweep";
import { DecoBg } from "@/components/ui/DecoBg";
import { SectionArt } from "@/components/ui/SectionArt";
import { TornEdge } from "@/components/ui/TornEdge";
import { deco } from "@/data/brand-art";
import { cldUrl } from "@/lib/image-loader";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  beyondSlides,
  brandFilm,
  concernTitle,
  endorsements,
  promoStrip,
  proofCards,
  spotlight,
  topPicks,
} from "@/data/home";
import type { Product } from "@/lib/commerce/types";
import { cn } from "@/lib/utils/cn";
import { siteVideo } from "@/lib/site-videos";

const POUR = siteVideo("ghani-pour-desktop", 960);
import { ArrowRow } from "./ArrowRow";
import { FilmShowcase } from "./FilmShowcase";
import type { ReelItem } from "./Reels";
import type { PickProduct } from "./pickProduct";
import { TabbedCarousel, type CarouselTab } from "./TabbedCarousel";
import { defaultVariant } from "@/lib/commerce/default-variant";

/** Narrow content column with room on both sides for carousel arrows (Two Brothers layout). */
function Wrap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1180px] px-4 md:px-16", className)}
    >
      {children}
    </div>
  );
}

/* ───────────── 1. Top Picks For You ───────────── */

export function TopPicks({ tabs }: { tabs: CarouselTab[] }) {
  return (
    <section className="paper-grain relative overflow-hidden bg-page pt-16 pb-4 md:pt-20 md:pb-8">
      <Sky />
      <Wrap className="relative !max-w-[1920px] px-4 md:px-[72px]">
        <Reveal>
          <h2 className="text-center text-[26px] text-forest md:text-[44px]">
            {topPicks.title}
          </h2>
        </Reveal>
        <div className="mt-6 md:mt-8">
          <TabbedCarousel tabs={tabs} variant="center" />
        </div>
      </Wrap>
    </section>
  );
}


/** Sun + birds (left) and clouds + neem (right) around the heading. CSS backgrounds: decorative, never LCP. */
function Sky() {
  const bg = (src: string, w: number) => ({ backgroundImage: `url("${cldUrl(src, w)}")` });
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute top-2 -left-4 aspect-[900/299] w-40 bg-contain bg-no-repeat opacity-90 sm:w-56 md:top-4 md:left-0 lg:w-[340px] xl:w-[400px]"
        style={bg("https://res.cloudinary.com/bmqxsylj/image/upload/v1793735964/swadeshi-mahadev/static/images/deco/sky-sun-birds.webp", 800)}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 aspect-[900/243] w-44 bg-contain bg-right-top bg-no-repeat opacity-95 sm:w-60 lg:w-[360px] xl:w-[420px]"
        style={bg("https://res.cloudinary.com/bmqxsylj/image/upload/v1793735962/swadeshi-mahadev/static/images/deco/sky-clouds-neem.webp", 840)}
      />
    </>
  );
}

/* ───────────── 2. Promo strip ───────────── */

export function PromoStrip() {
  return (
    <section aria-label={promoStrip.tag} className="bg-[#023019] py-1.5">
      <Link
        href={promoStrip.cta.href}
        className="group relative block h-[300px] overflow-hidden sm:h-[380px] border-y-[3px] border-[#E8B032] bg-[#03331C] md:h-[420px]"
      >
        {/* Real footage: oil pouring from our wooden ghani. Desktop plays the muted loop on the right,
            fading into the green; mobile uses the still frame behind a dark overlay. */}
        <Image src={POUR.poster} alt="" fill sizes="100vw" className="object-cover md:hidden" />
        <div aria-hidden className="absolute inset-0 bg-[#03331C]/75 md:hidden" />
        <video
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[64%] object-cover [mask-image:linear-gradient(90deg,transparent_0%,#000_38%)] md:block"
          src={POUR.src}
          poster={POUR.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(60%_80%_at_20%_50%,rgba(3,51,28,0.95),transparent_70%)] md:block" />
        <ReflectionSweep />

        <div className="relative z-10 mx-auto flex h-full max-w-[1360px] flex-col items-center justify-center gap-3 px-5 text-center sm:gap-4 sm:px-6 md:items-start md:px-12 md:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#E8B032]/40 bg-black/20 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-khaki uppercase sm:text-xs backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#E8B032]" />
            {promoStrip.tag}
          </p>
          <div>
            <p className="text-[26px] leading-tight font-bold text-balance text-[#E8B032] sm:text-3xl lg:text-[52px]">{promoStrip.line1}</p>
            <p className="mt-1.5 max-w-md text-[15px] leading-snug font-medium text-khaki-soft sm:mt-2 sm:text-lg lg:text-xl">{promoStrip.line2}</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-1.5 sm:gap-2 md:justify-start">
            {promoStrip.points.map((pt) => (
              <li key={pt} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs text-khaki-soft backdrop-blur-sm">
                <Check className="size-3.5 text-[#E8B032]" strokeWidth={3} aria-hidden />
                {pt}
              </li>
            ))}
          </ul>
          <span className="btn-shine inline-flex h-11 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-[#E8B032] px-6 text-[13px] sm:h-12 sm:px-7 sm:text-sm font-bold tracking-wide text-forest-deep uppercase transition-colors duration-200 group-hover:bg-khaki">
            {promoStrip.cta.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
}

/* ───────────── 3. Brand film ───────────── */

export function BrandFilmSection({ youtube, reels = [] }: { youtube: string; /** Two reels stacked on the film's right. */ reels?: ReelItem[] }) {
  // Painted folk birds on the top-right margin, behind the content (smaller on phones).
  return (
    <section id="story" className="relative scroll-mt-20 overflow-hidden bg-forest-deep pt-10 pb-10 md:pt-24 md:pb-24">
      <TornEdge color="var(--color-page)" />
      {/* Deep forest "screening room" band: warm lamp-light glow behind the film */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[38%] left-1/2 h-[520px] w-[min(1100px,95vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(232,200,121,0.22),transparent)] blur-2xl"
      />
      <SectionArt
        art={deco.birds}
        className="top-4 -right-6 w-[120px] opacity-95 md:top-10 md:right-2 md:w-[200px] xl:right-[4%] xl:w-[240px]"
        sizes="(min-width: 1280px) 240px, (min-width: 768px) 200px, 120px"
      />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <Reveal className="flex flex-col items-center text-center">
          <p className="font-hindi flex items-center gap-2 text-base text-[#e8c879] md:text-lg" lang="hi">
            <span aria-hidden className="h-px w-6 bg-[#e8c879]/60" />
            हमारी कहानी
            <span aria-hidden className="h-px w-6 bg-[#e8c879]/60" />
          </p>
          <h2 className="mt-1.5 max-w-[18ch] text-[24px] leading-[1.1] font-bold tracking-tight text-balance text-[#fbf3df] sm:max-w-none md:text-[44px]">
            {brandFilm.titleRest}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-white/70 md:mt-3 md:text-base">
            Watch one batch go from seed to bottle in our ghani: cleaned by hand, pressed slow, nothing added.
          </p>
        </Reveal>
        <div className="mt-6 md:mt-10">
          <FilmShowcase youtube={youtube} title={brandFilm.posterTitle} subtitle={brandFilm.posterSub} reels={reels} />
        </div>
      </div>
    </section>
  );
}

/* ───────────── 4. Good Oil Backed by Proof ───────────── */

export function ProofCards() {
  return (
    <section className="bg-page pb-14 md:pb-20">
      <Wrap>
        <Reveal>
          <h2 className="pt-6 text-center text-3xl text-forest md:pt-8 md:text-[40px]">
            Good Oil Backed by Proof
          </h2>
        </Reveal>
        <Stagger variant="linear" className="mt-8 grid gap-4 sm:grid-cols-3 md:mt-10 md:gap-5">
          {proofCards.map((c) => (
            <StaggerItem key={c.seal}>
              <Link
                href={c.href}
                className="flex h-full flex-col items-center rounded-lg bg-white p-6 text-center transition-colors duration-200 hover:bg-page md:p-7"
              >
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={`${c.seal} · ${c.sealSub}`}
                    width={560}
                    height={560}
                    sizes="144px"
                    className="size-36 object-contain"
                  />
                ) : (
                  <Seal label={c.seal} sub={c.sealSub} />
                )}
                <p className="mt-5 text-sm leading-relaxed text-forest-text">
                  {c.text}
                </p>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Wrap>
    </section>
  );
}

function Seal({ label, sub }: { label: string; sub: string }) {
  return (
    <span
      className="relative grid size-36 place-items-center rounded-full border-[3px] border-forest bg-[#FBF5E6] text-forest"
      aria-hidden
    >
      <span className="absolute inset-1.5 rounded-full border border-dashed border-forest/60" />
      <span className="px-3 text-center">
        <span className="block text-base leading-tight font-bold">{label}</span>
        <span className="mt-1 block rounded-sm bg-forest px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {sub}
        </span>
      </span>
    </span>
  );
}

/* ───────────── 5. Shop By Use ───────────── */

export function ShopByUseCarousel({ tabs }: { tabs: CarouselTab[] }) {
  return (
    <section className="relative overflow-hidden bg-page pt-2 pb-12 md:pt-4 md:pb-16">
      <Wrap className="relative !max-w-[1920px] px-4 md:px-[72px]">
        <div>
          <Reveal>
            <h2 className="text-3xl text-sale md:text-[44px]">
              {concernTitle.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="relative inline-block">
                {concernTitle.split(" ").at(-1)}
                <svg
                  viewBox="0 0 24 24"
                  className="absolute -top-2 -right-5 size-5 text-mustard"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2c1 4 3 6 7 7-4 1-6 3-7 7-1-4-3-6-7-7 4-1 6-3 7-7z" />
                </svg>
              </span>
            </h2>
          </Reveal>
        </div>
        <div className="mt-6 md:mt-8">
          <TabbedCarousel tabs={tabs} variant="left" />
        </div>
      </Wrap>
    </section>
  );
}

/* ───────────── 6. Spotlight ───────────── */

export function Spotlight({
  products,
  fadeTo = "var(--color-page)",
}: {
  products: Product[];
  /** Colour of the section below, so the watercolour melts into it. */
  fadeTo?: string;
}) {
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  return (
    <section className="relative overflow-hidden bg-page pt-6 md:pt-16">
      {/* Soft watercolor dunes + sun rays (hand-painted). Purely decorative. */}
      <DecoBg
        src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735965/swadeshi-mahadev/static/images/deco/spotlight-bg.webp"
        className="[mask-image:linear-gradient(to_bottom,transparent,black_160px)]"
      />
      {/* Fade into the next section's colour so there is no seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: `linear-gradient(to bottom, transparent, ${fadeTo})` }}
      />
      <Wrap className="relative">
        <Reveal className="text-center md:text-left">
          <h2 className="inline-flex items-center gap-2 text-[24px] text-forest-text md:text-[44px]">
            Spotlight
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-[#E0A526] md:size-8"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
            </svg>
          </h2>
        </Reveal>
        <div className="mt-4 md:mt-8" data-spot-root="">
          <SpotlightStage
            items={spotlight.map((sp) => {
              const p = byHandle.get(sp.handle);
              const v = p ? defaultVariant(p) : undefined;
              return {
                ...sp,
                titleHi: p?.titleHi ?? "",
                swatch: p?.swatch ?? "#d0b17a",
                // Owner (2026-11-10): no product photo in the spotlight for now.
                rating: p?.rating,
                reviewCount: p?.reviewCount,
                variant: v ? { id: v.id, title: v.title, price: v.price.amount, mrp: v.compareAtPrice?.amount } : undefined,
              };
            })}
          />
        </div>
        <Endorsements />
      </Wrap>
    </section>
  );
}

/* ───────────── 7. Endorsements (inside Spotlight band, like Two Brothers) ───────────── */

function Endorsements() {
  // Placeholder cards hidden for now (see HIDDEN.md). Real reviews still render when added.
  const SHOW_REVIEW_PLACEHOLDERS = false;
  if (!endorsements.length && !SHOW_REVIEW_PLACEHOLDERS)
    return <div className="pb-12 md:pb-16" />;

  const placeholder = !endorsements.length;
  const items = placeholder
    ? Array.from({ length: 3 }, () => ({
        name: "Verified customer",
        role: "",
        quote: "",
        avatar: undefined,
      }))
    : endorsements;

  return (
    <div className="pt-10 pb-14 md:pt-12 md:pb-20">
      <ArrowRow label="What people say" arrowTop="55%">
        {items.map((e, i) => (
          <figure
            key={i}
            className="relative flex w-[85%] shrink-0 snap-start flex-col rounded-2xl bg-white/85 p-5 pt-6 ring-1 ring-[#EADBC4] backdrop-blur-[2px] sm:w-[48%] md:w-[calc((100%-2rem)/3)] md:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-khaki-soft text-forest ring-2 ring-[#EADBC4]">
                {e.avatar ? (
                  <SmartImage
                    src={e.avatar}
                    alt=""
                    width={48}
                    height={48}
                    className="size-full object-cover"
                  />
                ) : (
                  <UserGlyph />
                )}
              </span>
              <figcaption className="min-w-0">
                <span className="block text-sm font-bold text-forest-text">
                  {e.name}
                </span>
                {e.role && (
                  <span className="block text-xs text-ink-muted">{e.role}</span>
                )}
              </figcaption>
              {!placeholder && (
                <span
                  className="ml-auto flex text-mustard"
                  aria-label="5 out of 5"
                >
                  {Array.from({ length: 5 }, (_, k) => (
                    <svg
                      key={k}
                      viewBox="0 0 20 20"
                      className="size-3.5"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
                    </svg>
                  ))}
                </span>
              )}
            </div>
            <svg
              viewBox="0 0 24 24"
              className="mt-4 size-6 text-khaki"
              fill="currentColor"
              aria-hidden
            >
              <path d="M9.5 6C6.5 7 5 9.4 5 12.6V18h5.5v-5.5H7.7c0-2 .9-3.4 2.6-4.2L9.5 6zm9 0c-3 1-4.5 3.4-4.5 6.6V18h5.5v-5.5h-2.8c0-2 .9-3.4 2.6-4.2L18.5 6z" />
            </svg>
            <blockquote
              className={cn(
                "mt-2 text-[15px] leading-relaxed",
                placeholder ? "text-ink-muted" : "text-forest-deep",
              )}
            >
              {/* TODO(client): real, verified quotes with permission. Placeholder shows in development only. */}
              {e.quote || "A verified customer review will appear here."}
            </blockquote>
          </figure>
        ))}
      </ArrowRow>
    </div>
  );
}

function UserGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── 8. Beyond our Oils ───────────── */

export function BeyondOils() {
  return (
    <section className="grid bg-page md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
      <div className="relative flex items-center justify-center overflow-hidden px-6 pt-10 pb-28 md:py-0 md:pb-16">
        {/* Hand-painted mustard plants, dry grass and a low sun along the bottom edge. */}
        <Image
          src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735934/swadeshi-mahadev/static/images/deco/beyond-grass-sun.webp"
          alt=""
          aria-hidden
          width={900}
          height={217}
          sizes="(min-width: 768px) 30vw, 100vw"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full"
        />
        <Reveal className="relative">
          <h2 className="text-center text-4xl leading-tight text-[#6B4A16] md:text-5xl">
            Beyond
            <br />
            our Oils
          </h2>
        </Reveal>
      </div>
      <div className="px-4 pt-2 pb-8 md:py-8 md:pr-16 md:pl-6">
        <ArrowRow label="Beyond our oils" className="gap-0 md:gap-0">
          {beyondSlides.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative block aspect-[16/8] w-full shrink-0 snap-start overflow-hidden rounded-xl md:aspect-[16/7]"
              style={{ backgroundColor: s.bg }}
            >
              <svg
                aria-hidden
                viewBox="0 0 800 350"
                preserveAspectRatio="none"
                className="absolute inset-0 size-full"
              >
                <g fill="#D0B17A" opacity="0.12">
                  <circle cx="620" cy="90" r="120" />
                  <circle cx="160" cy="60" r="60" />
                </g>
                <path
                  d="M0 240 Q200 190 400 225 T800 205 L800 350 L0 350 Z"
                  fill="#6B4A16"
                />
              </svg>
              <span className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-5 text-white md:pb-7">
                <span className="text-3xl md:text-5xl">
                  <span className="font-extrabold tracking-tight">
                    {s.bold}
                  </span>{" "}
                  <span className="font-display text-khaki">{s.script}</span>
                </span>
                <span className="mt-1 text-sm text-khaki-soft md:text-base">
                  {s.sub}
                </span>
              </span>
            </Link>
          ))}
        </ArrowRow>
      </div>
    </section>
  );
}

export type { PickProduct };
