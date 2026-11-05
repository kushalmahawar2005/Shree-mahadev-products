"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, FileText, FlaskConical, PlayCircle, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { cn } from "@/lib/utils/cn";

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
  const [open, setOpen] = useState<null | "lab" | "fssai">(null);
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

  const cards = [
    {
      key: "lab",
      seal: SEALS.lab,
      title: "Lab tested",
      text: `${reports.length} of our oils tested at ${lab}. Read the full report for each one.`,
      doc: reports[0] ? `/proof/${reports[0].slug}-thumb.webp` : null,
      action: { label: "View lab reports", icon: FlaskConical, onClick: () => (setI(0), setOpen("lab")) },
    },
    {
      key: "fssai",
      seal: SEALS.fssai,
      title: "FSSAI licensed",
      text: `State licence No. ${fssaiNo}, valid till ${fssaiValidTill}. The same number is printed on every label.`,
      doc: "/proof/fssai-licence-thumb.webp",
      action: { label: "View licence", icon: FileText, onClick: () => setOpen("fssai") },
    },
    {
      key: "ghani",
      seal: SEALS.ghani,
      title: "Wood-pressed, kachi ghani",
      text: "Pressed slowly in a wooden ghani. No heat, no chemicals, no refining. The oil settles naturally before bottling.",
      doc: null,
      action: { label: "See how it's made", icon: PlayCircle, href: "#story" },
    },
  ] as const;

  return (
    <section className="paper-grain relative overflow-hidden bg-[#F5EDDE] pt-14 pb-10 md:pt-20 md:pb-12">
      <div className="relative mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="mb-10 flex flex-col items-center gap-2 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sale uppercase">
            <ShieldCheck className="size-3.5" /> Don&apos;t just take our word
          </p>
          <h2 className="text-3xl md:text-[44px]">Good oil, backed by proof</h2>
          <p className="max-w-xl text-ink-muted">Real reports and licences, issued to Mahadev Products. Open any of them.</p>
        </div>

        <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
          {cards.map((c, n) => {
            const Icon = c.action.icon;
            const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white transition-colors hover:bg-forest-mid";
            return (
              <motion.li
                key={c.key}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: n * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-white p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow duration-500 hover:shadow-[0_30px_50px_-30px_rgba(7,47,27,0.5)]"
              >
                <Image
                  src={c.seal}
                  alt=""
                  width={280}
                  height={280}
                  sizes="128px"
                  className="mx-auto size-32 object-contain transition-transform duration-[1200ms] ease-[var(--ease-premium)] group-hover:rotate-[20deg]"
                />
                <h3 className="mt-4 text-xl">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{c.text}</p>

                {/* The real document peeks out of the card and lifts on hover */}
                <div className="relative mt-5 h-32 overflow-hidden md:h-36">
                  {c.doc ? (
                    <Image
                      src={c.doc}
                      alt=""
                      width={360}
                      height={500}
                      sizes="200px"
                      className="absolute top-3 left-1/2 w-44 -translate-x-1/2 rotate-[-4deg] rounded-md border border-line shadow-[0_18px_30px_-16px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-[var(--ease-premium)] group-hover:-translate-y-6 group-hover:rotate-0"
                    />
                  ) : (
                    <div className="absolute inset-x-6 top-3 grid h-32 place-items-center overflow-hidden rounded-xl bg-forest text-white transition-transform duration-500 group-hover:-translate-y-4">
                      <Image src="/videos/ghani-pour-desktop.jpg" alt="" fill sizes="300px" className="object-cover opacity-70" />
                      <PlayCircle className="relative size-10 text-mustard drop-shadow" />
                    </div>
                  )}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/90 to-transparent" />
                </div>

                <div className="relative mt-1">
                  {"href" in c.action ? (
                    <Link href={c.action.href} className={btn}>
                      <Icon className="size-4" /> {c.action.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={c.action.onClick} className={btn}>
                      <Icon className="size-4" /> {c.action.label}
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>

        {/* Fact strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-forest-text">
          {[`FSSAI Lic. ${fssaiNo}`, `Valid till ${fssaiValidTill}`, `Tested at ${lab}`].map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 font-medium">
              <BadgeCheck className="size-3.5 text-forest" /> {f}
            </span>
          ))}
          <Link href="/lab-reports" className="inline-flex items-center gap-1 px-2 font-semibold text-forest hover:underline">
            All lab reports <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[min(760px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-line bg-[#fcf9f2] p-0 sm:max-w-none">
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
