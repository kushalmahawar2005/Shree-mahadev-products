"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Check, Copy, Loader2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { lockScroll, unlockScroll } from "@/components/motion/scroll-lock";
import { submitLeadAction } from "@/lib/lead-actions";
import { emitMarketingEvent } from "@/lib/marketing-events";
import type { PublicLeadPopup } from "@/lib/lead-popup";

const STORE_KEY = "smp_welcome_offer";
const SNOOZE_DAYS = 3;
/** Never interrupt someone who is already buying or managing an order. */
const QUIET_PATHS = ["/cart", "/checkout", "/account", "/order", "/track-order"];

function seenRecently() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as { state: string; at: number } | null;
    if (!v) return false;
    if (v.state === "done") return true;
    return Date.now() - v.at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
function remember(state: "done" | "dismissed") {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ state, at: Date.now() }));
  } catch {
    // storage blocked: popup may show again next visit, that's fine
  }
}
const consentChosen = () => document.cookie.split("; ").some((c) => c.startsWith("smp_consent="));

/** Welcome-offer popup: shows once after `delaySec`, collects name + phone, reveals the coupon code. */
export function WelcomeOffer({ config }: { config: PublicLeadPopup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!config || quiet || seenRecently()) return;
    let poll = 0;
    const timer = window.setTimeout(() => {
      // Wait for the privacy banner to be answered so the two never stack.
      const tryOpen = () => {
        if (seenRecently()) return;
        if (consentChosen()) setOpen(true);
        else poll = window.setTimeout(tryOpen, 1500);
      };
      tryOpen();
    }, config.delaySec * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(poll);
    };
  }, [config, quiet]);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => unlockScroll();
  }, [open]);

  if (!config) return null;

  const onOpenChange = (next: boolean) => {
    if (!next) remember(seenRecently() ? "done" : "dismissed");
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-3xl border-0 bg-white p-0 shadow-2xl sm:max-w-[760px] md:grid md:grid-cols-[1fr_1.15fr]"
      >
        <OfferPanel percent={config.percent} />
        <FormPanel percent={config.percent} />
        <DialogClose
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm transition-colors hover:bg-khaki-soft focus-visible:ring-2 focus-visible:ring-forest focus-visible:outline-none md:bg-khaki-soft"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function OfferPanel({ percent }: { percent: number }) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden bg-forest px-6 py-5 text-white md:flex-col md:items-start md:justify-between md:gap-8 md:px-8 md:py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-khaki/20 blur-3xl md:-bottom-24 md:-left-20 md:top-auto md:right-auto"
      />
      <Image
        src="/images/deco/seal-kachi-ghani.webp"
        alt=""
        width={112}
        height={112}
        className="relative size-16 shrink-0 md:size-24"
      />
      <div className="relative">
        <p className="text-xs font-semibold tracking-[0.18em] text-khaki uppercase">Welcome offer</p>
        <p className="mt-1 flex items-baseline gap-1.5 leading-none">
          <span className="text-5xl font-extrabold tracking-tight md:text-7xl">{percent}%</span>
          <span className="text-lg font-semibold text-khaki md:text-2xl">off</span>
        </p>
        <p className="mt-2 hidden max-w-[16rem] text-sm leading-relaxed text-white/75 md:block">
          On your first order of our wood-pressed, kachi ghani oils.
        </p>
      </div>
    </div>
  );
}

function FormPanel({ percent }: { percent: number }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      const res = await submitLeadAction({
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        page: pathname,
      });
      if (!res.ok) return setError(res.error);
      remember("done");
      setCode(res.code);
      emitMarketingEvent("Lead", { content_name: "welcome_offer" });
    });

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: code stays visible to type
    }
  };

  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <div className="px-6 pt-6 pb-7 md:px-9 md:pt-10 md:pb-9">
      <AnimatePresence mode="wait" initial={false}>
        {!code ? (
          <motion.div key="form" {...fade}>
            <DialogTitle className="text-2xl font-bold tracking-tight text-forest-text md:text-[1.7rem] md:leading-tight">
              Get {percent}% off your first order
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
              Share your name and mobile number. Your discount code shows up right here.
            </DialogDescription>
            <form action={submit} className="mt-6 space-y-3" noValidate>
              <label className="block">
                <span className="sr-only">Your name</span>
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  maxLength={80}
                  className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/15"
                />
              </label>
              <label className="flex h-12 items-center rounded-xl border border-line bg-white focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
                <span className="border-r border-line px-3.5 text-base font-medium text-ink-muted">+91</span>
                <span className="sr-only">Mobile number</span>
                <input
                  name="phone"
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="Mobile number"
                  maxLength={14}
                  className="h-full min-w-0 flex-1 rounded-r-xl bg-transparent px-3.5 text-base text-ink outline-none placeholder:text-ink-muted/70"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-sale">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-forest text-base font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-70"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Get my code
              </button>
              <p className="text-center text-xs text-ink-muted">We only message you about orders and offers. No spam.</p>
            </form>
          </motion.div>
        ) : (
          <motion.div key="done" {...fade} className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="grid size-11 place-items-center rounded-full bg-khaki-soft text-forest">
              <Check className="size-5" />
            </span>
            <DialogTitle className="mt-4 text-2xl font-bold tracking-tight text-forest-text">Your code is ready</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
              Apply it at checkout for {percent}% off your first order.
            </DialogDescription>
            <button
              type="button"
              onClick={copy}
              className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-khaki bg-khaki-soft px-5 py-4 text-left transition-colors hover:border-forest"
              aria-label={`Copy code ${code}`}
            >
              <span className="font-mono text-2xl font-bold tracking-[0.12em] text-forest-text">{code}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </span>
            </button>
            <DialogClose className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-forest text-base font-semibold text-white transition-colors hover:bg-forest-mid">
              Start shopping
            </DialogClose>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
