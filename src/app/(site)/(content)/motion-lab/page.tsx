import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck as Award, Droplets, Leaf, Sun } from "@/components/icons/duo";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { LabControls } from "@/components/motion-lab/LabControls";
import { ImageReveal, ImageTextReveal, MaskedText, Reveal, StaggerGrid, StaggerItem } from "@/components/motion/Reveal";
import { ProductGrid } from "@/components/product/ProductGrid";
import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { SmartImage } from "@/components/ui/SmartImage";
import { getProducts } from "@/lib/commerce";
import { getHeroSlides } from "@/lib/hero";
import { HERO_HEIGHT, HERO_WIDTH } from "@/data/hero";

export const metadata: Metadata = {
  title: "Motion lab",
  robots: { index: false, follow: false },
};

const features = [
  { Icon: Leaf, title: "Kachi ghani", text: "Slow wood press, no heat." },
  { Icon: Droplets, title: "Unrefined", text: "Never bleached or deodorised." },
  { Icon: Sun, title: "Sun-settled", text: "Rested, then cloth-filtered." },
  { Icon: Award, title: "Lab tested", text: "Every batch, reports online." },
];

/** Internal demo of the storefront motion system (not linked, not indexed). */
export default async function MotionLabPage() {
  // Developer playground for animations: never part of the live store.
  if (process.env.NODE_ENV === "production") notFound();
  const [slides, products] = await Promise.all([getHeroSlides(), getProducts()]);
  const banner = slides[1] ?? slides[0];

  return (
    <div className="pb-24">
      <section aria-label="Hero slideshow">
        <HeroCarousel slides={slides} />
      </section>

      <div className="mx-auto max-w-[1360px] px-4 md:px-8">
        <header className="py-16 text-center md:py-24">
          <Reveal>
            <p className="text-xs font-bold tracking-[0.2em] text-sale uppercase">Motion lab</p>
          </Reveal>
          <MaskedText
            as="h1"
            text="Every reveal, hover and drawer of the store, in one place"
            className="mx-auto mt-3 block max-w-3xl text-4xl leading-tight font-bold text-forest-text md:text-6xl"
          />
          <Reveal delay={0.2}>
            <p className="mx-auto mt-5 max-w-xl text-ink-muted">
              Scroll slowly. Each block animates once as it enters. Reduced-motion users get plain fades.{" "}
              <AnimatedLink href="/shop" className="font-semibold text-forest">Animated underline link</AnimatedLink>
            </p>
          </Reveal>
        </header>

        <section className="py-10">
          <Reveal>
            <h2 className="mb-8 text-2xl font-bold text-forest-text md:text-3xl">Product grid · decelerating stagger</h2>
          </Reveal>
          <ProductGrid products={products.slice(0, 8)} />
        </section>

        <section className="py-16">
          <Reveal>
            <h2 className="mb-8 text-2xl font-bold text-forest-text md:text-3xl">Feature columns · linear stagger</h2>
          </Reveal>
          <StaggerGrid variant="linear" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {features.map(({ Icon, title, text }) => (
              <StaggerItem key={title} className="rounded-2xl border border-line bg-white p-6">
                <Icon className="size-8" />
                <p className="mt-4 text-lg font-bold text-forest-text">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{text}</p>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </section>
      </div>

      {banner && (
        <ImageTextReveal className="my-16 text-white">
          <div data-banner-img="" className="absolute inset-0 overflow-hidden">
            <SmartImage src={banner.src} alt="" width={HERO_WIDTH} height={HERO_HEIGHT} sizes="100vw" className="size-full object-cover object-right" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-forest-deep from-35% via-forest-deep/85 via-55% to-transparent" />
          </div>
          <div data-banner-content="" className="relative mx-auto flex min-h-[460px] max-w-[1360px] flex-col justify-center px-6 py-16 md:min-h-[560px] md:px-12">
            <MaskedText manual as="h2" text="Pressed slowly. Poured honestly." className="block max-w-xl text-4xl leading-tight font-bold md:text-6xl" />
            <div data-banner-body="" className="mt-5 max-w-md">
              <p className="text-white/85">Image scales in, then the heading rises line by line, then this copy and the button fade in.</p>
              <Link href="/our-ghani" className="btn-slant btn-slant-mustard mt-6 inline-flex h-12 items-center rounded-full px-7 text-sm font-bold text-forest-deep">
                See our ghani
              </Link>
            </div>
          </div>
        </ImageTextReveal>
      )}

      <div className="mx-auto max-w-[1360px] px-4 md:px-8">
        <section className="grid gap-10 py-16 md:grid-cols-2 md:items-center">
          {banner && (
            <ImageReveal className="aspect-[4/3] rounded-3xl">
              <SmartImage src={banner.src} alt="" width={HERO_WIDTH} height={HERO_HEIGHT} sizes="(min-width: 768px) 50vw, 100vw" className="size-full object-cover" />
            </ImageReveal>
          )}
          <div>
            <MaskedText as="h2" text="Buttons, drawers and small accents" className="block text-3xl font-bold text-forest-text md:text-4xl" />
            <Reveal className="mt-6 space-y-6">
              <LabControls />
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-forest">
                  <span className="live-dot size-2 rounded-full bg-[#2f9e44]" /> Live dot
                </span>
                <span className="blink-soft rounded-full bg-sale px-3 py-1 text-xs font-bold text-white">SAVE 20%</span>
                <span className="shine-badge relative rounded-full bg-forest px-3 py-1 text-xs font-bold text-white">Limited batch</span>
                <span className="play-ripple grid size-12 place-items-center rounded-full bg-forest text-white" aria-label="Play ripple">
                  <svg viewBox="0 0 24 24" className="ml-0.5 size-5 fill-current" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                </span>
              </div>
              <p className="text-sm text-ink-muted">
                Sticky add-to-cart lives on product pages:{" "}
                {products[0] && (
                  <AnimatedLink href={`/products/${products[0].handle}`} className="font-semibold text-forest">
                    open {products[0].title}
                  </AnimatedLink>
                )}
              </p>
            </Reveal>
          </div>
        </section>
      </div>
    </div>
  );
}
