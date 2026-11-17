"use client";

import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ease } from "@/components/chat/motion";

/** Devanagari text gets Mukta at 16px / 1.6 so matras are not clipped. */
export const isHindi = (text: string) => /[\u0900-\u097F]/.test(text);
export const textClass = (text: string) => (isHindi(text) ? "font-[family-name:var(--font-mukta)] text-[16px] leading-[1.6]" : "text-[15px] leading-normal");

/** "Soch raha hoon…": three dots in a wave plus the label. */
export function TypingWave({ label = "Soch raha hoon…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-2.5" role="status" aria-label={label}>
      <span className="flex items-end gap-1" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <motion.span key={dot} className="size-1.5 rounded-full bg-forest" animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.25, delay: dot * 0.12, ease: ease.inOutCubic }} />
        ))}
      </span>
      <span className="text-[12.5px] text-ink-muted">{label}</span>
    </div>
  );
}
import { ArrowUpRight, CheckCircle2, Circle, Truck } from "lucide-react";

export type Source = { title: string; href: string };
export type Suggestion = { label: string; href?: string };
export type ProductCard = { title: string; href: string; image: string | null; price: number; inStock: boolean };
export type TrackingEvent = { status: string; label: string; at: string; location: string | null };

/** Tiny markdown subset (bold + bullet lines) for bot replies. Hand-rolled: a full markdown lib is overkill here. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold text-forest-text">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>);
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`ul-${blocks.length}`} className="my-1 space-y-1 pl-1">{bullets.map((item, index) => <li key={index} className="flex gap-2"><span className="mt-[.55em] size-1.5 shrink-0 rounded-full bg-mustard" />{<span>{inline(item)}</span>}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) { bullets.push(bullet[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}


const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function ProductCards({ items }: { items: ProductCard[] }) {
  if (!items.length) return null;
  return (
    <div className="-mx-1 mt-2.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {items.map((item, index) => (
        <motion.div key={item.href} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.08 + index * 0.06 }} className="w-36 shrink-0 snap-start">
        <Link href={item.href} className="group block overflow-hidden rounded-xl border border-line bg-white transition duration-300 hover:-translate-y-1 hover:border-forest/25 hover:shadow-[0_10px_24px_rgba(7,47,27,.12)]">
          <div className="relative aspect-square bg-co-panel">
            {item.image && <Image src={item.image} alt={item.title} fill sizes="144px" className="object-contain p-2 transition duration-500 group-hover:scale-110 group-hover:-rotate-2" />}
            {!item.inStock && <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-alert">Out of stock</span>}
          </div>
          <div className="p-2">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink">{item.title}</p>
            <p className="mt-1 flex items-center justify-between text-xs text-ink-muted">from <span className="font-bold text-forest">{rupee(item.price)}</span></p>
          </div>
        </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function SourceLinks({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2">
      {sources.slice(0, 3).map((source) => (
        <Link key={source.href + source.title} href={source.href} className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-co-panel px-2.5 py-1 text-[11px] font-semibold text-forest hover:bg-co-brand-soft">
          <span className="truncate">{source.title}</span><ArrowUpRight size={11} className="shrink-0" />
        </Link>
      ))}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function when(value: string) {
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}+05:30`);
  return Number.isNaN(date.getTime()) ? value : dateFmt.format(date);
}

export function TrackingTimeline({ events, courier, awb, eta, url }: { events: TrackingEvent[]; courier?: string | null; awb?: string | null; eta?: string | null; url?: string | null }) {
  const ordered = [...events].reverse();
  return (
    <div className="rounded-xl bg-co-panel p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-forest"><Truck size={16} />Delivery update</p>
      {(courier || eta) && <p className="mt-1 text-xs text-ink-muted">{courier}{awb ? ` · AWB ${awb}` : ""}{eta ? `${courier ? " · " : ""}ETA ${eta}` : ""}</p>}
      {!!ordered.length && (
        <ol className="relative mt-3 space-y-3 before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-px before:bg-line">
          {ordered.slice(0, 5).map((event, index) => (
            <motion.li key={`${event.at}-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.07, duration: 0.3 }} className="relative flex gap-3 pl-0">
              {index === 0
                ? <span className="relative z-10 mt-0.5 grid size-[15px] shrink-0 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-forest/30 motion-reduce:hidden" /><CheckCircle2 size={15} className="relative rounded-full bg-co-panel text-forest" /></span>
                : <Circle size={15} className="relative z-10 mt-0.5 shrink-0 rounded-full bg-co-panel text-line" />}
              <div className="min-w-0">
                <p className={`capitalize leading-tight ${index === 0 ? "font-semibold text-ink" : "text-ink-muted"}`}>{event.label.toLowerCase()}</p>
                <p className="text-[11px] text-ink-muted">{when(event.at)}{event.location ? ` · ${event.location}` : ""}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
      {url && <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest underline underline-offset-2">Live courier tracking <ArrowUpRight size={12} /></a>}
    </div>
  );
}
