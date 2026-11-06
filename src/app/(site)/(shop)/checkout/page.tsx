import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Check, Lock, ShoppingBag } from "lucide-react";
import { getCartAction } from "@/lib/commerce/actions";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-16 md:px-8 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2.5 text-2xl md:text-3xl">
          Secure checkout <Lock className="size-5 text-forest/60" />
        </h1>
        {/* Progress */}
        <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Checkout progress">
          {[
            ["Cart", true],
            ["Details", false],
            ["Payment", false],
          ].map(([label, done], i) => (
            <li key={String(label)} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-line md:w-10" />}
              <span className={i === 1 ? "inline-flex items-center gap-1.5 rounded-full bg-forest px-3 py-1 text-white" : done ? "inline-flex items-center gap-1.5 text-forest" : "inline-flex items-center gap-1.5 text-ink-muted"}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : <span className="tabular-nums">{i + 1}</span>}
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Suspense
        fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-white/60" />}
      >
        <CheckoutContent />
      </Suspense>
    </div>
  );
}

async function CheckoutContent() {
  await connection();
  const cart = await getCartAction();
  if (!cart?.lines.length) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-khaki-soft text-forest">
          <ShoppingBag className="size-7" strokeWidth={1.5} />
        </span>
        <p className="mt-4 text-lg font-bold text-forest-text">Your cart is empty</p>
        <Link href="/shop" className="btn-shine mt-6 inline-flex h-12 items-center overflow-hidden rounded-full bg-forest px-7 text-sm font-bold text-white">
          Shop oils
        </Link>
      </div>
    );
  }
  return (
    <CheckoutForm
      subtotal={cart.subtotal.amount}
      lines={cart.lines.map((l) => ({
        id: l.id,
        title: l.product.title,
        variant: l.variant.title,
        quantity: l.quantity,
        lineTotal: l.variant.price.amount * l.quantity,
        image: l.product.images[0],
      }))}
    />
  );
}
