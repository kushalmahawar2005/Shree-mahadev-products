"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Lock, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { AccountMenuLogin, LOGIN_INITIAL, type LoginState } from "@/components/layout/AccountMenuLogin";
import { ShieldCheck, Truck } from "@/components/icons/duo";

const EVENT = "smp:open-login";
const LOGO = "https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png";

/** Opens the login popup from anywhere (header Login click, phone bottom bar…). */
export function openLoginModal() {
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Checkout-style login popup (like a payment gateway sheet): brand header band, then the same
 * WhatsApp / Email OTP flow as the header dropdown. Mounted once in the site layout.
 */
export function LoginModal() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoginState>(LOGIN_INITIAL);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // A finished login reloads the page; otherwise keep what was typed in case they reopen it.
        if (!o && state.step === "done") setState(LOGIN_INITIAL);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[min(400px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-[0_32px_80px_-24px_rgba(7,47,27,0.55)] sm:max-w-none"
      >
        {/* Brand band */}
        <div className="relative bg-forest px-5 pt-5 pb-6 text-white">
          <span aria-hidden className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-white/[0.06]" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
              <Image src={LOGO} alt="" width={44} height={44} unoptimized className="size-10" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[17px] leading-tight font-bold text-white">Swadeshi Mahadev Products</DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1 text-[12px] text-white/70">
                <Lock className="size-3" aria-hidden /> Secure login with OTP
              </DialogDescription>
            </div>
          </div>
          <DialogClose
            aria-label="Close"
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        {/* Same flow as the header dropdown; the card overlaps the band like a checkout sheet. */}
        <div className="relative -mt-3 rounded-t-3xl bg-white">
          <AccountMenuLogin state={state} setState={setState} onEngage={() => {}} reduce={!!reduce} />
        </div>

        <div className="flex items-center justify-center gap-4 border-t border-line bg-ivory/50 px-5 py-3 text-[11.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-forest" /> Track orders
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="size-4 text-forest" /> Saved addresses
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
