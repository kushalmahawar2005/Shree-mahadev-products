"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { cn } from "@/lib/utils/cn";
import { SectionArt } from "@/components/ui/SectionArt";
import { TornEdge } from "@/components/ui/TornEdge";
import { deco } from "@/data/brand-art";
import { ProofCard, type ProofMedia } from "./ProofCard";

export type LabReport = { slug: string; name: string; reportNo: string };

const SEALS = {
  lab: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735960/swadeshi-mahadev/static/images/deco/seal-lab-tested.webp",
  fssai: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793739929/swadeshi-mahadev/static/images/deco/seal-fssai.webp",
  ghani: "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735946/swadeshi-mahadev/static/images/deco/seal-kachi-ghani.webp",
};

/**
 * "Backed by proof": three cards with a real document peeking out of each (lab report, FSSAI
 * licence) that lifts on hover; buttons open the actual scans in a lightbox. Lab reports can be
 * browsed per oil. Only documents issued to Mahadev Products are shown.
 */
export function ProofSection({ reports, fssaiNo, fssaiValidTill, lab }: { reports: LabReport[]; fssaiNo: string; fssaiValidTill: string; lab: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<null | "lab" | "fssai" | "video">(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const r = reports[i];
  const go = (d: 1 | -1) => {
    setDir(d);
    setI((n) => (n + d + reports.length) % reports.length);
  };

  useEffect(() => {
    if (open !== "lab") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go only uses setters
  }, [open]);

  const cards: {
    key: string;
    seal: string;
    title: string;
    fact: string;
    text: string;
    media: ProofMedia;
    onOpenMedia: () => void;
    cta: { label: string; href?: string; onClick?: () => void };
  }[] = [
    {
      key: "lab",
      seal: SEALS.lab,
      title: "Lab tested",
      fact: `${reports.length} oils · ${lab}`,
      text: "Every oil checked by an independent lab. Read the full report for each one.",
      media: reports[0]
        ? { kind: "doc", src: `/proof/${reports[0].slug}.webp`, back: reports[1] ? `/proof/${reports[1].slug}-thumb.webp` : undefined, alt: `Lab report: ${reports[0].name}` }
        : { kind: "video", poster: "/videos/ghani-pour-desktop.jpg", alt: "Lab reports" },
      onOpenMedia: () => (setI(0), setOpen("lab")),
      cta: { label: "View lab reports", onClick: () => (setI(0), setOpen("lab")) },
    },
    {
      key: "fssai",
      seal: SEALS.fssai,
      title: "FSSAI licensed",
      fact: `Lic. ${fssaiNo} · valid till ${fssaiValidTill}`,
      text: "The same licence number is printed on every bottle we sell.",
      media: { kind: "doc", src: "/proof/fssai-licence.webp", alt: `FSSAI licence ${fssaiNo}` },
      onOpenMedia: () => setOpen("fssai"),
      cta: { label: "View licence", onClick: () => setOpen("fssai") },
    },
    {
      key: "ghani",
      seal: SEALS.ghani,
      title: "Wood-pressed, kachi ghani",
      fact: "Kachi ghani · no heat · no chemicals",
      text: "Pressed slowly in a wooden ghani, then left to settle naturally before bottling.",
      media: { kind: "video", poster: "/videos/ghani-pour-desktop.jpg", alt: "Oil pouring from our wooden ghani" },
      onOpenMedia: () => setOpen("video"),
      cta: { label: "See how it's made", href: "#story" },
    },
  ];

  return (
    <section id="proof" className="paper-grain relative scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,#f8e8bb_0%,#f4dea0_100%)] pt-10 pb-10 md:pt-20 md:pb-20">
      {/* Top edge comes from the sage Shop-by-use band above (its flip edge is this section's colour) */}
      {/* Warm haldi band prop on the right margin (desktop): a painted matka, never over the cards */}
      <SectionArt
        art={deco.matka}
        className="right-[1%] bottom-6 hidden w-[180px] min-[1600px]:block min-[1800px]:w-[220px]"
        sizes="(min-width: 1536px) 220px, 170px"
        drift={24}
      />
      <div className="relative mx-auto max-w-[1360px] px-4 md:px-8">
        <div className="mb-5 flex flex-col items-center text-center md:mb-12">
          <p className="font-hindi flex items-center gap-2 text-base text-[#8a4b0b] md:text-lg" lang="hi">
            <span aria-hidden className="h-px w-6 bg-[#8a4b0b]/50" />
            भरोसे का सबूत
            <span aria-hidden className="h-px w-6 bg-[#8a4b0b]/50" />
          </p>
          <h2 className="mt-1.5 text-[24px] leading-[1.1] font-bold tracking-tight md:mt-2 md:text-[44px]">Good oil, backed by proof</h2>
          <p className="mt-2 max-w-xl text-sm text-[#5a4a32] md:mt-3 md:text-base">Real reports and licences, issued to Mahadev Products. Open any of them.</p>
        </div>

        {/* Equal-height cards: fixed 4:3 media + CTA pinned to the bottom, so titles and CTAs align */}
        {/* Phones: one row of three small cards. md+: card grid. */}
        <ul className="grid grid-cols-3 gap-2 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {cards.map((c, n) => (
            <motion.li
              key={c.key}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: n * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <ProofCard media={c.media} seal={c.seal} title={c.title} fact={c.fact} text={c.text} cta={c.cta} onOpenMedia={c.onOpenMedia} />
            </motion.li>
          ))}
        </ul>

        <div className="mt-5 flex justify-center md:mt-8">
          <Link href="/lab-reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-text underline-offset-4 hover:underline">
            All lab reports <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <TornEdge flip color="var(--color-page)" />

      {/* Lightbox */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[min(760px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-line bg-[#fcf9f2] p-0 sm:max-w-none">
          {open === "video" && (
            <>
              <DialogTitle className="sr-only">Oil pouring from our wooden ghani</DialogTitle>
              <video src="/videos/ghani-pour-desktop.mp4" poster="/videos/ghani-pour-desktop.jpg" autoPlay controls playsInline className="aspect-video w-full bg-black" />
            </>
          )}
          {open === "fssai" && (
            <>
              <div className="border-b border-line bg-white px-5 py-4">
                <DialogTitle className="text-lg">FSSAI licence</DialogTitle>
                <DialogDescription className="text-xs text-ink-muted">
                  State licence No. {fssaiNo} · valid till {fssaiValidTill}
                </DialogDescription>
              </div>
              <div className="flex max-h-[78dvh] justify-center overflow-y-auto p-4" data-lenis-prevent="">
                <Image src="/proof/fssai-licence.webp" alt={`FSSAI licence ${fssaiNo}`} width={1100} height={1556} className="block h-auto w-full max-w-[680px] rounded-lg border border-line bg-white" />
              </div>
            </>
          )}
          {open === "lab" && r && (
            <>
              <div className="border-b border-line bg-white px-5 pt-4 pb-3">
                <DialogTitle className="text-lg">Lab report · {r.name}</DialogTitle>
                <DialogDescription className="text-xs text-ink-muted">
                  {lab} · Report No. {r.reportNo}
                </DialogDescription>
                <div className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {reports.map((x, n) => (
                      <button
                        key={x.slug}
                        type="button"
                        onClick={() => (setDir(n > i ? 1 : -1), setI(n))}
                        className={cn(
                          "h-7 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                          n === i ? "border-forest bg-forest text-white" : "border-line bg-white text-ink-muted hover:text-forest",
                        )}
                      >
                        {x.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <div className="h-full max-h-[64dvh] overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-16" data-lenis-prevent="">
                  <AnimatePresence mode="wait" initial={false} custom={dir}>
                    <motion.div
                      key={r.slug}
                      custom={dir}
                      className="flex touch-pan-y justify-center"
                      initial={{ opacity: 0, x: dir * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: dir * -40 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.25}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -60 || info.velocity.x < -400) go(1);
                        else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
                      }}
                    >
                      <Image
                        src={`/proof/${r.slug}.webp`}
                        alt={`Lab report for ${r.name}`}
                        width={1100}
                        height={1556}
                        draggable={false}
                        className="block h-auto w-full max-w-[680px] rounded-lg border border-line bg-white select-none"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
                {/* Arrows outside the document (desktop); phones swipe */}
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white/90 text-forest shadow-lg backdrop-blur transition-transform hover:scale-105 sm:grid"
                  aria-label="Previous report"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-white/90 text-forest shadow-lg backdrop-blur transition-transform hover:scale-105 sm:grid"
                  aria-label="Next report"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-line bg-white px-4 py-2.5 text-xs text-ink-muted">
                <button type="button" onClick={() => go(-1)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 font-semibold text-forest hover:bg-khaki-soft sm:hidden" aria-label="Previous report">
                  <ChevronLeft className="size-4" /> Prev
                </button>
                <span className="mx-auto tabular-nums sm:mx-0">
                  {i + 1} / {reports.length}
                  <span className="hidden sm:inline"> · use ← → keys</span>
                  <span className="sm:hidden"> · swipe</span>
                </span>
                <button type="button" onClick={() => go(1)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 font-semibold text-forest hover:bg-khaki-soft sm:hidden" aria-label="Next report">
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
