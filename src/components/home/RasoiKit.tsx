"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { SmartImage } from "@/components/ui/SmartImage";
import { formatMoney } from "@/lib/utils/money";

/**
 * Rasoi Starter Kit feature card (AGENTS.md §8 "Combos / Rasoi kits").
 * Adapted from a design draft: wired to our cart (useCart) and catalog.
 *
 * Until the client creates a real kit product, "Add kit to cart" adds the three items individually,
 * and only when all three have a confirmed price. TODO(client): kit contents, kit price, kit product/variant.
 */

export type KitItem = {
  name: string;
  size: string;
  swatch?: string;
  image?: { url: string; alt: string; width: number; height: number };
  variantId?: string;
  price?: number; // 0 / undefined = price not confirmed
  compareAt?: number;
};

export function RasoiKit({
  kitName = "Rasoi Starter Kit",
  items,
  kitPrice,
  href,
  freeShippingThreshold,
  codAvailable,
}: {
  kitName?: string;
  items: KitItem[];
  /** TODO(client): bundle price. Without it the sum of the items is shown. */
  kitPrice?: number;
  href: string;
  freeShippingThreshold: number;
  codAvailable: boolean;
}) {
  const { add, pending } = useCart();
  const allPriced = items.every((i) => i.price && i.variantId);
  const itemsTotal = allPriced
    ? items.reduce((s, i) => s + (i.price ?? 0), 0)
    : 0;
  const mrpTotal = allPriced
    ? items.reduce((s, i) => s + (i.compareAt ?? i.price ?? 0), 0)
    : 0;
  const price = kitPrice ?? itemsTotal;
  const save = mrpTotal > price ? mrpTotal - price : 0;

  const addKit = async () => {
    for (const i of items) if (i.variantId) await add(i.variantId, 1);
  };

  return (
    <section
      aria-labelledby="rasoi-kit-heading"
      className="bg-[#FEF1DC] px-4 py-14 md:py-20"
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-forest-deep text-white md:grid-cols-2">
        {/* Visual: the three bottles on a warm panel, framed by the hand-painted ghani + kadhai */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#03331C] md:aspect-auto md:min-h-[440px]">
          {/* Hand-painted ghani fills the left; the three bottles sit in front of it on the right. */}
          <Image
            src="/images/deco/promo-left.webp"
            alt=""
            aria-hidden
            width={416}
            height={497}
            sizes="(min-width: 768px) 30vw, 60vw"
            className="pointer-events-none absolute bottom-0 left-0 h-full w-auto"
          />
          <div className="absolute right-[5%] bottom-[8%] flex w-[58%] items-end justify-center gap-2">
            {items.slice(0, 3).map((it, idx) => (
              <div
                key={it.name}
                className={
                  idx === 1
                    ? "relative z-[2] w-[38%]"
                    : "relative z-[1] w-[31%]"
                }
              >
                {it.image && (
                  <SmartImage
                    src={it.image.url}
                    alt={`${it.name} ${it.size}`}
                    width={it.image.width}
                    height={it.image.height}
                    sizes="180px"
                    className="aspect-square w-full rounded-2xl object-cover shadow-[0_12px_30px_-14px_rgba(0,0,0,0.6)] ring-4 ring-white"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col justify-center gap-6 p-6 sm:p-10 md:p-12">
          <h2
            id="rasoi-kit-heading"
            className="text-3xl leading-[1.1] text-white md:text-[44px]"
          >
            Still cooking in refined oil?
            <span className="mt-2 block text-khaki">Your nani never did.</span>
          </h2>

          <div>
            <p className="text-lg font-semibold">{kitName}</p>
            <ul className="mt-3 space-y-2">
              {items.map((it) => (
                <li
                  key={it.name}
                  className="flex items-center gap-3 text-white/90"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full ring-1 ring-white/30"
                    style={{ backgroundColor: it.swatch }}
                  />
                  <span className="flex-1">{it.name}</span>
                  <span className="text-white/70">{it.size}</span>
                </li>
              ))}
            </ul>
          </div>

          {price > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold text-[#E8B032]">
                {formatMoney(price)}
              </span>
              {save > 0 && (
                <>
                  <s className="text-white/60">
                    <span className="sr-only">MRP </span>
                    {formatMoney(mrpTotal)}
                  </s>
                  <span className="rounded-full bg-[#E8B032] px-3 py-1 text-sm font-semibold text-forest-deep">
                    Save {formatMoney(save)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-white/70">Kit price coming soon</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={addKit}
              disabled={!allPriced || pending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#E8B032] px-8 font-semibold text-forest-deep transition-colors duration-200 hover:bg-khaki disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Adding…" : "Add kit to cart"}
            </button>
            <Link
              href={href}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-4 font-medium text-khaki underline-offset-4 hover:underline"
            >
              See what&apos;s inside
            </Link>
          </div>

          {/* TODO(client): confirm free-shipping threshold, COD charges */}
          <p className="text-sm text-white/70">
            Free shipping above {formatMoney(freeShippingThreshold)}
            {codAvailable && " · Cash on delivery available"}
          </p>
        </div>
      </div>
    </section>
  );
}
