"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { ArrowLeftRight, ArrowUpRight, Check, Minus } from "lucide-react";

const ROWS = [
  { label: "Extraction", ours: "Slow wooden ghani, low temperature", refined: "High-heat pressing, often solvent extraction" },
  { label: "Processing", ours: "Seed extraction, cotton cloth filtration, then natural settling", refined: "Multiple refining stages, chemical processing, industrial filtration" },
  { label: "Taste & aroma", ours: "Authentic, natural flavour of the seed", refined: "Neutral, little aroma" },
];

export function GhaniVsRefined() {
  const [position, setPosition] = useState(50);
  const captionId = useId();
  return (
    <div className="grid items-stretch overflow-hidden rounded-3xl border border-line bg-[#fffcf4] shadow-[0_4px_24px_rgba(14,59,38,.04)] lg:grid-cols-[1.12fr_1fr]">
      <figure className="flex min-w-0 flex-col bg-forest">
        <div className="relative isolate flex-1 overflow-hidden bg-sunken lg:min-h-72 focus-within:ring-4 focus-within:ring-inset focus-within:ring-mustard" style={{ aspectRatio: "16 / 10" }}>
          <Image src="/images/product-story/refined-cold-v1.webp" alt="Watercolour illustration of an industrial oil refinery in a cool village landscape" fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <Image src="/images/product-story/ghani-warm-v1.webp" alt="Watercolour illustration of our yellow kachi ghani pressing seeds into golden oil in a Rajasthan village" fill sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 flex justify-between gap-3 sm:inset-x-6 sm:top-6">
            <span className="rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white sm:px-4 sm:text-sm">Our kachi ghani</span>
            <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink sm:px-4 sm:text-sm">Refined</span>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-sm" style={{ left: `${position}%` }} />
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-forest text-white shadow-lg sm:size-14" style={{ left: `${Math.max(5, Math.min(95, position))}%` }}>
            <ArrowLeftRight className="size-5 sm:size-6" />
          </div>
          <input type="range" min={0} max={100} step={1} value={position} onChange={(event) => setPosition(Number(event.target.value))} aria-label="Compare kachi ghani and refined oil illustrations" aria-describedby={captionId} aria-valuetext={`${position}% kachi ghani illustration revealed`} className="absolute inset-0 z-10 h-full w-full cursor-ew-resize touch-pan-y opacity-0" />
        </div>
        <figcaption id={captionId} className="bg-forest px-5 py-2.5 text-center text-xs text-white sm:text-sm">
          Drag to see the difference <span aria-hidden="true">↔</span>
          <span className="sr-only">. Use arrow keys to adjust. Home shows the refinery; End shows the ghani.</span>
        </figcaption>
      </figure>
      <div className="px-4 py-5 sm:px-8 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-forest sm:text-xl">How the oils differ</h3>
          <Link href="/our-ghani" className="inline-flex items-center gap-1 text-sm font-semibold text-forest underline decoration-mustard underline-offset-4">Visit our ghani <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#ebeedd] px-3 py-3">
          <p className="font-semibold text-forest">Mahadev kachi ghani</p>
          <p className="font-semibold text-ink-muted">Typical refined oil</p>
        </div>
        <dl className="divide-y divide-line">
          {ROWS.map((row) => (
            <div key={row.label} className="py-3 last:pb-0">
              <dt className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">{row.label}</dt>
              <dd className="grid grid-cols-2 gap-5 text-sm leading-relaxed sm:gap-8 sm:text-[15px]">
                <span className="flex gap-2 text-ink"><Check className="mt-1 size-4 shrink-0 text-forest" aria-hidden="true" /><span><span className="sr-only">Mahadev: </span>{row.ours}</span></span>
                <span className="flex gap-2 text-ink-muted"><Minus className="mt-1 size-4 shrink-0" aria-hidden="true" /><span><span className="sr-only">Refined: </span>{row.refined}</span></span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
