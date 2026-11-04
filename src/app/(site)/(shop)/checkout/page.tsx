import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { buttonClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/primitives";
import { getCartAction } from "@/lib/commerce/actions";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <Container className="max-w-6xl py-10 md:py-14">
      <h1 className="text-4xl md:text-5xl">Checkout</h1>
      <Suspense
        fallback={<p className="mt-8 text-ink-muted">Loading your cart…</p>}
      >
        <CheckoutContent />
      </Suspense>
    </Container>
  );
}

async function CheckoutContent() {
  await connection();
  const cart = await getCartAction();
  if (!cart?.lines.length) {
    return (
      <div className="mt-8">
        <p className="text-lg text-ink-muted">Your cart is empty.</p>
        <Link href="/shop" className={buttonClass("primary", "lg", "mt-6")}>
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
