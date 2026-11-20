"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Lock, ShieldCheck } from "@/components/icons/duo";
import { confirmCashfreePaymentAction } from "@/lib/payment-actions";

type Phase = "opening" | "open" | "checking" | "closed" | "error";

/**
 * Opens Cashfree's payment popup on top of our page (no redirect away from the site). When the popup
 * finishes, the server asks Cashfree for the real status, then we go to the order page. If the shopper
 * closes the popup, they can open it again with the same session.
 */
export function CashfreeCheckout({ sessionId, mode, orderToken }: { sessionId: string; mode: "sandbox" | "production"; orderToken: string }) {
  const [phase, setPhase] = useState<Phase>("opening");
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);
  // After a failed attempt, retry with a fresh payment session (reload creates a new attempt);
  // after a simple close, the same session can be reopened.
  const retryFresh = useRef(false);

  const open = useCallback(async () => {
    setMessage(null);
    setPhase("opening");
    try {
      const { load } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await load({ mode });
      if (!cashfree) throw new Error("Payment window could not load");
      setPhase("open");
      const result = await cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_modal" });
      // In-app browsers can't show the popup: Cashfree takes over the page and returns via return_url.
      if (result.redirect) return;
      setPhase("checking");
      let { outcome } = await confirmCashfreePaymentAction(orderToken);
      // The popup says the payment finished, but Cashfree's API can lag a few seconds behind it.
      // Ask again before telling the shopper it didn't go through.
      for (let i = 0; i < 5 && result.paymentDetails && (outcome === "unpaid" || outcome === "none"); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        ({ outcome } = await confirmCashfreePaymentAction(orderToken));
      }
      if (outcome === "paid" || outcome === "pending") {
        // Full load through the return route: it clears the cart cookie and redirects to the order page,
        // so the header's cart count is fresh (a client-side navigation would keep the old count).
        window.location.replace(`/api/cashfree/return?t=${orderToken}`);
        return;
      }
      setPhase("closed");
      setMessage(
        outcome === "failed"
          ? "The payment didn't go through. If money was deducted it comes back automatically; you can try again."
          : "You closed the payment window. Your items are kept for you.",
      );
      retryFresh.current = outcome !== "unpaid";
    } catch (e) {
      setPhase("error");
      setMessage((e as Error).message || "Something went wrong opening the payment window.");
    }
  }, [mode, orderToken, sessionId]);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice in dev
    started.current = true;
    void open();
  }, [open]);

  const busy = phase === "opening" || phase === "open" || phase === "checking";
  return (
    <div className="flex flex-col items-center">
      <span className="relative grid size-16 place-items-center rounded-full bg-khaki-soft">
        {busy && <Loader2 className="absolute size-16 animate-spin text-forest/30" strokeWidth={1} />}
        {busy ? <Lock className="size-6 text-forest" /> : <AlertCircle className="size-6 text-mustard" />}
      </span>
      <h1 className="mt-5 text-2xl">
        {phase === "checking" ? "Confirming your payment…" : phase === "open" ? "Complete payment in the window" : busy ? "Opening secure payment…" : "Payment not completed"}
      </h1>
      {message && <p className="mt-2 text-sm text-ink-muted">{message}</p>}
      {!busy && (
        <button
          type="button"
          onClick={() => (retryFresh.current ? window.location.reload() : void open())}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest px-8 text-sm font-bold text-white hover:bg-forest-mid"
        >
          <Lock className="size-4" /> Try payment again
        </button>
      )}
      {!busy && (
        <a href="/checkout" className="mt-3 text-sm font-semibold text-forest underline-offset-4 hover:underline">
          Change payment method or edit order
        </a>
      )}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
        <ShieldCheck className="size-3.5 text-forest" /> Secured by Cashfree · Please don&apos;t press back
      </p>
    </div>
  );
}
