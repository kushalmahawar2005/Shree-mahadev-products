import Image from "next/image";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ReflectionSweep } from "@/components/motion/ReflectionSweep";
import { DecoBg } from "@/components/ui/DecoBg";
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
import { ArrowRow } from "./ArrowRow";
import { BrandFilm } from "./BrandFilm";
import type { PickProduct } from "./pickProduct";
import { TabbedCarousel, type CarouselTab } from "./TabbedCarousel";

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
    <section className="relative overflow-hidden bg-[#FBF8F2] pt-16 pb-12 md:pt-20 md:pb-16">
      <Sky />
      <Wrap className="relative">
        <Reveal>
          <h2 className="text-center text-3xl text-forest md:text-[44px]">
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
        className="group relative flex h-[190px] items-center justify-center overflow-hidden border-y-[3px] border-[#E8B032] bg-[#03331C] md:h-[150px]"
      >
        <ReflectionSweep />
        {/* Hand-painted art cropped from one banner: ghani on the left, kadhai tadka on the right. */}
        <Image
          src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735938/swadeshi-mahadev/static/images/deco/promo-left.webp"
          alt=""
          width={416}
          height={497}
          sizes="200px"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto opacity-40 sm:opacity-100"
        />
        <Image
          src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735940/swadeshi-mahadev/static/images/deco/promo-right.webp"
          alt=""
          width={472}
          height={497}
          sizes="220px"
          className="pointer-events-none absolute top-0 right-0 h-full w-auto opacity-40 sm:opacity-100"
        />
        {/* Mobile: stacked + centred. Desktop: copy and button side by side, so the band stays slim. */}
        <div className="relative z-10 flex flex-col items-center gap-3 px-4 text-center md:max-w-[62%] md:flex-row md:gap-8 md:text-left">
          <div>
            <p className="text-xs font-semibold text-khaki sm:text-sm">
              {promoStrip.tag}
            </p>
            <p className="mt-0.5 text-2xl leading-tight font-bold text-[#E8B032] lg:text-[32px]">
              {promoStrip.line1}
            </p>
            <p className="text-lg leading-tight font-semibold text-khaki-soft lg:text-xl">
              {promoStrip.line2}
            </p>
          </div>
          <span className="btn-shine inline-flex min-h-11 shrink-0 items-center rounded-md bg-[#E8B032] px-5 text-sm font-bold text-forest-deep transition-colors duration-200 group-hover:bg-khaki">
            {promoStrip.cta.label}
          </span>
        </div>
      </Link>
    </section>
  );
}

/* ───────────── 3. Brand film ───────────── */

export function BrandFilmSection({ youtube }: { youtube: string }) {
  return (
    <section className="relative overflow-hidden bg-[#FEF1DC] pt-12 pb-[22vw] sm:pb-[12vw] md:pt-16">
      {/* Hand-painted landscape (dunes, hills, khejri tree, mustard field) anchored to the bottom; its empty sky blends into the section colour. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] [mask-image:linear-gradient(to_bottom,black_88%,transparent)] sm:h-auto sm:aspect-[3/1]"
      >
        <DecoBg
          src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735936/swadeshi-mahadev/static/images/deco/landscape-fields.webp"
          position="85% 100%"
        />
      </div>
      <Wrap className="relative">
        <Reveal>
          <h2 className="text-center text-2xl text-[#6B4A16] md:text-4xl">
            {brandFilm.titleLead}{" "}
            <span className="font-semibold">{brandFilm.titleRest}</span>
          </h2>
        </Reveal>
        <Reveal className="mx-auto mt-6 max-w-[860px] md:mt-8">
          <BrandFilm
            youtube={youtube}
            posterTitle={brandFilm.posterTitle}
            posterSub={brandFilm.posterSub}
          />
        </Reveal>
      </Wrap>
    </section>
  );
}

/* ───────────── 4. Good Oil Backed by Proof ───────────── */

export function ProofCards() {
  return (
    <section className="bg-[#FEF1DC] pb-14 md:pb-20">
      <Wrap>
        <Reveal>
          <h2 className="pt-6 text-center text-3xl text-forest md:pt-8 md:text-[40px]">
            Good Oil Backed by Proof
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 sm:grid-cols-3 md:mt-10 md:gap-5">
          {proofCards.map((c) => (
            <StaggerItem key={c.seal}>
              <Link
                href={c.href}
                className="flex h-full flex-col items-center rounded-lg bg-white p-6 text-center transition-colors duration-200 hover:bg-[#FBF8F2] md:p-7"
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
    <section className="relative overflow-hidden bg-[#FEF1DC] pt-2 pb-12 md:pt-4 md:pb-16">
      <Wrap className="relative">
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
          <TabbedCarousel tabs={tabs} variant="left" showDots />
        </div>
      </Wrap>
    </section>
  );
}

/* ───────────── 6. Spotlight ───────────── */

export function Spotlight({
  products,
  fadeTo = "#FCF2E5",
}: {
  products: Pick<Product, "handle" | "images">[];
  /** Colour of the section below, so the watercolour melts into it. */
  fadeTo?: string;
}) {
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  return (
    <section className="relative overflow-hidden bg-[#FEF1DC] pt-12 md:pt-16">
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
        <Reveal>
          <h2 className="inline-flex items-center gap-2 text-3xl text-mustard md:text-[44px]">
            Spotlight
            <svg
              viewBox="0 0 24 24"
              className="size-8 text-[#E0A526]"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
            </svg>
          </h2>
        </Reveal>
        <div className="mt-6 md:mt-8">
          <ArrowRow label="Spotlight" arrowTop="50%">
            {spotlight.flatMap((s) => {
              const img = byHandle.get(s.handle)?.images[0];
              const cell =
                "aspect-square w-[46%] shrink-0 snap-start overflow-hidden rounded-xl sm:w-[31%] md:w-[calc((100%-3rem)/4)]";
              return [
                <Link
                  key={`${s.handle}-img`}
                  href={`/products/${s.handle}`}
                  className={cn(cell, "group block bg-khaki-soft")}
                >
                  {img && (
                    <SmartImage
                      src={img.url}
                      alt={img.alt}
                      width={img.width}
                      height={img.height}
                      sizes="(min-width: 768px) 25vw, 46vw"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  )}
                </Link>,
                <Link
                  key={`${s.handle}-note`}
                  href={`/products/${s.handle}`}
                  className={cn(
                    cell,
                    "flex flex-col items-center justify-between p-4 text-center text-white md:p-6",
                  )}
                  style={{ backgroundColor: s.color }}
                >
                  <span className="text-base font-semibold md:text-lg">
                    {s.title}
                  </span>
                  <span className="line-clamp-5 text-xs leading-relaxed text-white/90 md:text-sm">
                    {s.text}
                  </span>
                  <span className="text-xs font-semibold text-khaki md:text-sm">
                    {s.note}
                  </span>
                </Link>,
              ];
            })}
          </ArrowRow>
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
    <section className="grid bg-[#FCF2E5] md:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
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
