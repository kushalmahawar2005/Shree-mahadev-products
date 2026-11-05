"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AnimatedShinyText } from "@/components/shadcn/animated-shiny-text";
import { BadgePercent, Check, Copy, Leaf, PackageCheck, Truck } from "lucide-react";
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

/**
 * Top strip. Desktop: one message at a time, sliding up every `intervalSec` (pauses on hover).
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
      {/* Desktop rotator */}
      <div
        className="relative hidden h-10 items-center justify-center md:flex"
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
        {items.length > 1 && (
          <div className="absolute right-6 flex gap-1.5" aria-hidden>
            {items.map((_, n) => (
              <span key={n} className={cn("h-1 rounded-full transition-all", n === i ? "w-4 bg-mustard" : "w-1 bg-white/30")} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile marquee */}
      <div className="relative md:hidden">
        {reduce || items.length < 2 ? (
          <div className="flex h-9 items-center justify-center px-4">
            <Item m={items[0]} compact />
          </div>
        ) : (
          <Marquee pauseOnHover className="h-9 p-0 [--duration:28s] [--gap:1.75rem]">
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
