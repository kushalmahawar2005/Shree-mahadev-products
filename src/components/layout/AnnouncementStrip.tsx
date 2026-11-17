"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { AnimatedShinyText } from "@/components/shadcn/animated-shiny-text";
import { Check, Copy } from "lucide-react";
import { BadgePercent, Boxes, Leaf, PackageCheck, Truck } from "@/components/icons/duo";
import { Marquee } from "@/components/shadcn/marquee";
import { cn } from "@/lib/utils/cn";

type Msg = { text: string; href: string };

/** Pick an icon from the message wording, so admin only types text. */
function MsgIcon({ text }: { text: string }) {
  const t = text.toLowerCase();
  const cls = "size-3.5";
  const icon = /%|off|discount|code|coupon/.test(t) ? (
    <BadgePercent className={cls} />
  ) : /free ship/.test(t) ? (
    <PackageCheck className={cls} />
  ) : /ship|deliver|doorstep|dispatch/.test(t) ? (
    <Truck className={cls} />
  ) : (
    <Leaf className={cls} />
  );
  return (
    <span aria-hidden className="shrink-0 text-mustard">
      {icon}
    </span>
  );
}
/** "… code WELCOME10" → WELCOME10 (shown as a copyable chip). */
const isOffer = (t: string) => /%|off|discount|code|coupon/i.test(t);
const codeIn = (t: string) => t.match(/\bcode[:\s]+([A-Z0-9_-]{3,20})\b/i)?.[1]?.toUpperCase() ?? null;

function CodeChip({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          // clipboard blocked: code is still visible
        }
      }}
      className="ml-2 inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-mustard/70 bg-white/5 px-2.5 font-mono text-[11px] font-bold tracking-wider text-mustard transition-colors hover:bg-mustard/15"
      aria-label={`Copy code ${code}`}
    >
      {code}
      {done ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

function Item({ m, compact }: { m: Msg; compact?: boolean }) {
  const code = codeIn(m.text);
  const label = code ? m.text.replace(/\s*[·\-–|]?\s*\bcode[:\s]+[A-Z0-9_-]{3,20}\b/i, "") : m.text;
  const text = isOffer(m.text) ? (
    <AnimatedShinyText shimmerWidth={120} className="mx-0 max-w-none text-white via-[#f3d67a]">
      {label}
    </AnimatedShinyText>
  ) : (
    <span>{label}</span>
  );
  // Link wraps only the text, so the copy-code button is never nested inside a link.
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium", compact && "text-xs")}>
      <MsgIcon text={m.text} />
      {m.href ? (
        <Link href={m.href} className="underline-offset-4 hover:underline">
          {text}
        </Link>
      ) : (
        text
      )}
      {code && <CodeChip code={code} />}
    </span>
  );
}

function Spark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-2 shrink-0 text-mustard/60">
      <path fill="currentColor" d="M12 0c.6 6.3 5.7 11.4 12 12-6.3.6-11.4 5.7-12 12-.6-6.3-5.7-11.4-12-12C6.3 11.4 11.4 6.3 12 0Z" />
    </svg>
  );
}

const QUICK_LINKS = [
  { label: "Our Ghani", href: "/our-ghani" },
  { label: "Lab Reports", href: "/lab-reports" },
];

/**
 * Top strip. Desktop: the message rotates on the left (one at a time, sliding up every `intervalSec`,
 * pauses on hover) with quick links on the right.
 * Mobile: Magic UI marquee. Reduced motion: first message, static.
 */
export function AnnouncementStrip({ items, intervalSec }: { items: Msg[]; intervalSec: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (items.length < 2 || paused || reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), Math.max(3, intervalSec) * 1000);
    return () => clearInterval(t);
  }, [items.length, intervalSec, paused, reduce]);

  return (
    <div className="relative overflow-hidden bg-forest-deep text-white" aria-label="Store announcements">
      {/* Desktop: rotating message on the left, quick links on the right (aligned with the header) */}
      <div className="mx-auto hidden h-10 max-w-[1360px] items-center justify-between gap-6 px-8 md:flex">
        <div
          className="relative flex min-w-0 items-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          aria-live="polite"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={i}
              initial={{ y: 14, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -14, opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <Item m={items[i]} />
            </motion.div>
          </AnimatePresence>
        </div>
        <nav aria-label="Quick links" className="flex shrink-0 items-center gap-7">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[13px] font-medium text-white/75 transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
          {/* Bulk orders stands out as a thin gold outline pill (fills gold on hover). */}
          <Link
            href="/bulk-orders"
            className="group/bulk border-animation btn-shine relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-full border border-co-gold/40 px-3 text-[13px] font-semibold text-[#f3dc9a] transition-colors hover:border-co-gold hover:bg-co-gold hover:text-forest-deep"
          >
            <Boxes className="size-3.5" />
            Bulk orders
            <span className="text-[11px] font-medium text-co-gold/80 group-hover/bulk:text-forest-deep/70">5L · 15L</span>
          </Link>
        </nav>
      </div>

      {/* Mobile marquee */}
      <div className="relative md:hidden">
        {/* Reduced motion is decided in CSS (motion-safe / motion-reduce), not with a hook: the hook
            is unknown on the server, so branching on it caused a hydration mismatch. */}
        <div className={cn("flex h-9 items-center justify-center px-4", items.length > 1 && "motion-safe:hidden")}>
          <Item m={items[0]} compact />
        </div>
        {items.length > 1 && (
          <Marquee pauseOnHover className="h-9 p-0 [--duration:28s] [--gap:1.75rem] [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)] motion-reduce:hidden">
            {items.map((m) => (
              <span key={m.text} className="inline-flex items-center gap-7">
                <Item m={m} compact />
                <Spark />
              </span>
            ))}
          </Marquee>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-forest-deep to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-forest-deep to-transparent" />
      </div>
    </div>
  );
}
