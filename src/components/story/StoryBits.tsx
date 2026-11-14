import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BadgeCheck, Ban, Droplets, Factory, FlaskConical, Flame, Leaf, MapPin, Package, Palette, Sun, Timer } from "@/components/icons/duo";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { proof } from "@/data/home";
import { site } from "@/data/site";
import { siteVideo } from "@/lib/site-videos";

/** Verified facts only (licence, lab, ISO, place). */
export function FactsStrip() {
  const facts = [
    { I: Factory, t: "Kolhu wood pressed", d: "Slow kachi ghani, no heat" },
    { I: BadgeCheck, t: "FSSAI licensed", d: `Lic. ${proof.fssaiNo}` },
    { I: FlaskConical, t: "Lab tested", d: proof.lab },
    { I: MapPin, t: "Made in Bijainagar", d: `Beawar, Rajasthan · ${site.iso}` },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {facts.map(({ I, t, d }) => (
        <li key={t} className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:gap-3">
          <span className="shrink-0 text-forest">
            <I className="size-8" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-forest-text">{t}</span>
            <span className="block text-xs text-ink-muted">{d}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// TODO(client): seed source, settling time and batch numbering, then add them to these lines.
export const processSteps = [
  { I: Sun, title: "Seed selection", text: "Whole, mature seeds are cleaned and sun-dried before pressing." },
  { I: Timer, title: "Wooden ghani", text: "Seeds are crushed slowly in a wooden kolhu. The slow pace keeps the oil cool, so nothing is cooked out." },
  { I: Droplets, title: "Natural settling", text: "Fresh oil rests so the solids settle on their own, then it is filtered through cloth." },
  { I: Package, title: "Bottling", text: "Filled in small batches and sealed, ready to ship from Bijainagar." },
];

export function ProcessTimeline() {
  return (
    <Stagger variant="linear" as="ol" className="grid gap-4 md:grid-cols-4">
      {processSteps.map((s, i) => (
        <StaggerItem as="li" key={s.title} className="relative rounded-3xl border border-line bg-white p-5 md:p-6">
          <span className="flex items-center justify-between">
            <span className="shrink-0 text-forest">
              <s.I className="size-9" />
            </span>
            <span className="text-4xl font-extrabold text-khaki/40 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          </span>
          <h3 className="mt-3 text-lg md:mt-5 md:text-xl">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.text}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function NeverDo() {
  const items = [
    { I: Flame, t: "No external heat", d: "Nothing is warmed to push out more oil." },
    { I: FlaskConical, t: "No chemical solvents", d: "No hexane or extraction chemicals." },
    { I: Ban, t: "No refining", d: "No bleaching or deodorising." },
    { I: Palette, t: "Nothing added", d: "No colour, flavour or preservatives." },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ I, t, d }) => (
        <li key={t} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
          <span className="shrink-0 text-[#e8c879]">
            <I className="size-8" />
          </span>
          <span>
            <span className="block font-bold text-white">{t}</span>
            <span className="block text-sm text-white/70">{d}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const FILM = siteVideo("ghani-film", 960);

export function FilmFrame({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[28px] bg-forest ${className}`}>
      <video
        className="size-full object-cover"
        src={FILM.src}
        poster={FILM.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Our wooden ghani pressing seeds"
      />
    </div>
  );
}

export function StoryCta() {
  return (
    <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-forest p-6 text-white md:flex-row md:items-center md:p-10">
      <div>
        <p className="font-hindi text-lg text-[#e8c879]" lang="hi">
          स्वाद जो याद रहे
        </p>
        <h2 className="text-2xl text-white md:text-3xl">Taste the difference yourself</h2>
        <p className="mt-1 text-sm text-white/70">Every batch is lab tested. See the reports before you buy.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/shop" className="btn-shine inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-[#e8c879] px-6 text-sm font-bold text-forest-deep hover:bg-white">
          Shop now <ArrowRight className="size-4" />
        </Link>
        <Link href="/lab-reports" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10">
          <Leaf className="size-4" /> Lab reports
        </Link>
      </div>
    </div>
  );
}
