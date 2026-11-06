"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, ChevronLeft, ChevronRight, Download, FileText, FlaskConical, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import type { LabReport } from "@/components/home/ProofSection";

type Doc = { src: string; title: string; sub: string };

/** Lab report grid with search + a lightbox (shadcn Dialog, motion slide, arrow keys / swipe). */
export function LabReportsBrowser({ reports, lab, fssaiNo, fssaiValidTill }: { reports: LabReport[]; lab: string; fssaiNo: string; fssaiValidTill: string }) {
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);

  const shown = reports.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const reportDocs: Doc[] = reports.map((r) => ({ src: `/proof/${r.slug}.webp`, title: `${r.name} oil`, sub: `Report ${r.reportNo} · ${lab}` }));
  const fssaiDoc: Doc = { src: "/proof/fssai-licence.webp", title: "FSSAI licence", sub: `No. ${fssaiNo} · valid till ${fssaiValidTill}` };
  const doc = docs?.[i];
  const go = (d: 1 | -1) => {
    if (!docs || docs.length < 2) return;
    setDir(d);
    setI((n) => (n + d + docs.length) % docs.length);
  };

  useEffect(() => {
    if (!docs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go only uses setters + docs
  }, [docs]);

  return (
    <>
      {/* FSSAI */}
      <button
        type="button"
        onClick={() => (setI(0), setDocs([fssaiDoc]))}
        className="group mt-8 flex w-full flex-col items-start gap-5 rounded-3xl bg-forest p-6 text-left text-white sm:flex-row sm:items-center md:p-8"
      >
        <span className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg transition-transform group-hover:-rotate-2">
          <Image src="/proof/fssai-licence-thumb.webp" alt="" fill sizes="96px" className="object-cover object-top" />
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2 text-xl font-bold">
            <BadgeCheck className="size-5 text-[#e8c879]" /> FSSAI licensed
          </span>
          <span className="mt-1 block text-white/75">
            State licence No. <span className="font-mono text-white">{fssaiNo}</span>, valid till {fssaiValidTill}. The same number is printed on every label.
          </span>
        </span>
        <span className="inline-flex h-11 items-center gap-2 rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep group-hover:bg-white">
          <FileText className="size-4" /> View licence
        </span>
      </button>

      {/* Reports */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl md:text-3xl">
            <FlaskConical className="size-6 text-forest/60" /> Oil test reports
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {reports.length} reports from {lab}. Tap any report to read it in full.
          </p>
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Find a report</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find an oil…"
            className="h-11 w-full rounded-full border border-line bg-white pr-9 pl-10 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {shown.length ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
          {shown.map((r) => (
            <li key={r.slug}>
              <button
                type="button"
                onClick={() => (setI(reports.indexOf(r)), setDocs(reportDocs))}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition-shadow hover:shadow-[0_18px_36px_-24px_rgba(7,47,27,0.55)]"
              >
                <span className="relative aspect-[3/4] w-full overflow-hidden bg-subtle">
                  <Image src={`/proof/${r.slug}-thumb.webp`} alt={`${r.name} oil lab report`} fill sizes="(min-width:1024px) 220px, 45vw" className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                </span>
                <span className="p-3">
                  <span className="block font-bold text-forest-text">{r.name} oil</span>
                  <span className="block font-mono text-[11px] text-ink-muted">{r.reportNo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-sm text-ink-muted">No report matches &ldquo;{q}&rdquo;.</p>
      )}

      <Dialog open={!!docs} onOpenChange={(o) => !o && setDocs(null)}>
        <DialogContent className="max-h-[94svh] w-[min(96vw,760px)] max-w-none gap-0 overflow-hidden rounded-3xl bg-white p-0 sm:max-w-none" showCloseButton>
          {doc && (
            <>
              <div className="flex items-center gap-3 border-b border-line px-5 py-3 pr-12">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-lg">{doc.title}</DialogTitle>
                  <DialogDescription className="truncate text-xs">{doc.sub}</DialogDescription>
                </div>
                <a href={doc.src} download className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-forest-text hover:border-forest/40">
                  <Download className="size-3.5" /> Save
                </a>
              </div>
              <div className="relative max-h-[calc(94svh-64px)] overflow-y-auto bg-subtle" data-lenis-prevent="">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={doc.src}
                    initial={reduce ? false : { opacity: 0, x: dir * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduce ? undefined : { opacity: 0, x: dir * -40 }}
                    transition={{ duration: 0.3 }}
                    drag={docs && docs.length > 1 ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -60) go(1);
                      else if (info.offset.x > 60) go(-1);
                    }}
                    className="flex justify-center p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- full-size scan, natural height */}
                    <img src={doc.src} alt={doc.title} className="pointer-events-none block h-auto w-full max-w-[680px] rounded-lg shadow-sm" />
                  </motion.div>
                </AnimatePresence>
                {docs && docs.length > 1 && (
                  <>
                    <button type="button" onClick={() => go(-1)} aria-label="Previous report" className="fixed top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-forest shadow-md sm:absolute">
                      <ChevronLeft className="size-5" />
                    </button>
                    <button type="button" onClick={() => go(1)} aria-label="Next report" className="fixed top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-forest shadow-md sm:absolute">
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>
              {docs && docs.length > 1 && (
                <p className="border-t border-line py-2 text-center text-xs text-ink-muted tabular-nums">
                  {i + 1} / {docs.length} · use ← → or swipe
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
