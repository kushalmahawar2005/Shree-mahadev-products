"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gift, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { loadingBar } from "@/components/motion/LoadingBar";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { DUR, EASE } from "@/lib/motion";

/** Interactive bits of the motion lab: loading bar, cart drawer, loading button, modal, mini cart bar. */
export function LabControls() {
  const { open } = useCart();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [bar, setBar] = useState(false);

  const fakeWork = () => {
    setBusy(true);
    loadingBar.start();
    setTimeout(() => {
      loadingBar.done();
      setBusy(false);
    }, 1200);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={fakeWork} className="btn-slant inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white">
        {busy ? <LoadingDots /> : "Run loading bar"}
      </button>
      <button type="button" onClick={open} className="btn-slant inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white">
        <ShoppingBag className="size-4" /> Open cart drawer
      </button>
      <button type="button" onClick={() => setModal(true)} className="btn-slant btn-slant-light inline-flex h-12 items-center rounded-full border border-line px-6 text-sm font-bold text-forest-deep">
        Open modal
      </button>
      <button type="button" onClick={() => setBar((b) => !b)} className="btn-slant btn-slant-mustard inline-flex h-12 items-center rounded-full px-6 text-sm font-bold text-forest-deep">
        Toggle mini cart bar
      </button>

      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              onClick={() => setModal(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Example offer"
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: DUR.modal, ease: EASE.menuSlide }}
            >
              <button type="button" onClick={() => setModal(false)} aria-label="Close" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full hover:bg-khaki-soft">
                <X className="size-4" />
              </button>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-mustard/15 text-sale">
                <Gift className="wiggle size-7" />
              </span>
              <p className="mt-4 text-xl font-bold text-forest-text">Modal: slide up + fade</p>
              <p className="mt-1 text-sm text-ink-muted">Overlay 0.2s ease, panel 0.25s menuSlide from 24px.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {bar && (
        <div className="pop-up fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-forest-deep px-4 py-3 text-white shadow-xl">
          <span className="text-sm font-semibold">2 items · ₹520</span>
          <span className="rounded-full bg-mustard px-4 py-1.5 text-sm font-bold text-forest-deep">View cart</span>
        </div>
      )}
    </div>
  );
}
