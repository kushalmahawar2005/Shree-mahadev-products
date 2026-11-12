import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { ShoppingBag } from "lucide-react";
import { CheckoutForm, type SavedAddress } from "@/components/checkout/CheckoutForm";
import { Skeleton } from "@/components/shadcn/skeleton";
import { getProducts } from "@/lib/commerce";
import { getCartAction } from "@/lib/commerce/actions";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { getCustomerById } from "@/lib/server/customers";
import { INDIAN_STATES } from "@/lib/checkout";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="relative">
      <div className="relative mx-auto max-w-6xl px-4 pt-5 pb-10 md:px-6 md:pt-8 lg:pb-16">
        <Suspense fallback={<CheckoutSkeleton />}>
          <CheckoutContent />
        </Suspense>
      </div>
    </div>
  );
}

async function CheckoutContent() {
  await connection();
  const [cart, session, products] = await Promise.all([getCartAction(), getCustomerSession(), getProducts()]);
  if (!cart?.lines.length) {
    return (
      <div className="mx-auto mt-6 flex max-w-lg flex-col items-center rounded-3xl border border-line bg-white px-6 py-16 text-center">
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
  const customer = session ? await getCustomerById(session.id) : null;
  // Same address saved by several orders: show it once (newest first).
  const seen = new Set<string>();
  const addresses: SavedAddress[] = [];
  for (const a of customer?.addresses ?? []) {
    const key = `${a.line1.toLowerCase().replace(/[^a-z0-9]/g, "")}|${a.pincode}`;
    if (seen.has(key) || addresses.length >= 4) continue;
    seen.add(key);
    const state = INDIAN_STATES.find((s) => s.toLowerCase() === a.state.trim().toLowerCase()) ?? "";
    addresses.push({ name: a.name.trim(), phone: a.phone, line1: a.line1.trim(), line2: a.line2.trim(), city: a.city.trim(), state, pincode: a.pincode });
  }
  return (
    <CheckoutForm
      titlesHi={Object.fromEntries(products.map((p) => [p.handle, p.titleHi]))}
      catalog={products.map((p) => ({
        handle: p.handle,
        title: p.title,
        titleHi: p.titleHi,
        category: p.category,
        image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt } : undefined,
        defaultSize: p.defaultSize,
        variants: p.variants.map((v) => ({
          id: v.id,
          title: v.title,
          price: v.price.amount,
          mrp: v.compareAtPrice?.amount ?? null,
          available: v.availableForSale && v.price.amount > 0,
          size: v.sizeValue,
        })),
      }))}
      customer={session ? { name: session.name, phone: session.phone, email: session.email } : null}
      addresses={addresses}
    />
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl bg-white/70" />
        ))}
      </div>
      <Skeleton className="hidden h-[480px] rounded-3xl bg-white/70 lg:col-span-5 lg:block" />
    </div>
  );
}
