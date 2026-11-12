"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import {
  Check,
  Loader2,
  Minus,
  PartyPopper,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { useStoreSettings } from "@/components/StoreSettingsProvider";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/shadcn/sheet";
import { checkoutConfig } from "@/config/checkout";
import { useIsMobile } from "@/hooks/use-mobile";
import { cutoutUrl } from "@/lib/image-loader";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type CatalogItem = {
  handle: string;
  title: string;
  titleHi: string;
  category: "oil" | "honey" | "sweetener";
  image?: { url: string; alt: string };
  defaultSize?: string;
  variants: {
    id: string;
    title: string;
    price: number;
    mrp: number | null;
    available: boolean;
    size: number;
  }[];
};

const NF = {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
} as const;
const CHIPS = [
  { id: "all", label: "All" },
  { id: "oil", label: "Oils" },
  { id: "honey", label: "Honey" },
  { id: "sweetener", label: "Sweeteners" },
] as const;
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/**
 * "Add more" without leaving checkout: a few smart picks, search over the whole catalogue and
 * category chips. Rows already in the cart show a stepper synced with the order summary.
 */
export function AddMoreSheet({
  catalog,
  className,
  onClosed,
}: {
  catalog: CatalogItem[];
  className?: string;
  /** Variant ids added while the sheet was open (the summary flashes those rows). */
  onClosed?: (added: string[]) => void;
}) {
  const isMobile = useIsMobile();
  const { cart, error } = useCart();
  const { shipping: ship } = useStoreSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<(typeof CHIPS)[number]["id"]>("all");
  const added = useRef(new Set<string>());

  const lines = useMemo(() => cart?.lines ?? [], [cart]);
  const subtotal = cart?.subtotal.amount ?? 0;
  const mrpTotal = lines.reduce(
    (s, l) =>
      s +
      Math.max(l.variant.compareAtPrice?.amount ?? 0, l.variant.price.amount) *
        l.quantity,
    0,
  );
  const free = subtotal >= ship.freeShippingThreshold;

  const available = useMemo(
    () => catalog.filter((p) => p.variants.some((v) => v.available)),
    [catalog],
  );
  const picks = useMemo(() => {
    // Config list first, then categories the shopper doesn't have yet (honey/jaggery with oils),
    // then bestsellers (catalogue order). Nothing already in the cart, max 6.
    const inCart = new Set(lines.map((l) => l.product.handle));
    const cartCats = new Set(
      catalog.filter((p) => inCart.has(p.handle)).map((p) => p.category),
    );
    const byHandle = new Map(available.map((p) => [p.handle, p]));
    const cfg = (checkoutConfig.upsellHandles as readonly string[])
      .map((h) => byHandle.get(h))
      .filter((p): p is CatalogItem => !!p);
    const order = [
      ...cfg,
      ...available.filter((p) => !cartCats.has(p.category)),
      ...available,
    ];
    return [...new Set(order)].filter((p) => !inCart.has(p.handle)).slice(0, 6);
  }, [available, catalog, lines]);

  const q = query.trim().toLowerCase();
  const filtered = available.filter(
    (p) =>
      (chip === "all" || p.category === chip) &&
      (!q || `${p.title} ${p.titleHi} ${p.category}`.toLowerCase().includes(q)),
  );
  const browsing = !!q || chip !== "all";

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      onClosed?.([...added.current]);
      added.current.clear();
      setQuery("");
      setChip("all");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold text-forest hover:bg-co-brand-soft",
            className,
          )}
        >
          <Plus className="size-4" /> Add more
        </button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "co-theme flex flex-col gap-0 bg-white p-0 text-ink",
          isMobile ? "h-[85dvh] rounded-t-3xl" : "w-full sm:max-w-[440px]",
        )}
      >
        <SheetHeader className="shrink-0 gap-1 border-b border-line px-5 pt-5 pb-4">
          <SheetTitle className="text-lg text-ink">
            Add more to your order
          </SheetTitle>
          <SheetDescription className="text-ink-muted">
            Same delivery{free ? ", no extra shipping" : ""}
          </SheetDescription>
          <p
            className={cn(
              "mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold",
              free
                ? "bg-co-success-soft text-co-success"
                : "bg-co-accent-soft text-ink",
            )}
          >
            {free ? (
              <PartyPopper className="size-4 text-co-accent" />
            ) : (
              <Truck className="size-4 text-co-accent" />
            )}
            {free
              ? "Free shipping unlocked"
              : `Add ${formatMoney(ship.freeShippingThreshold - subtotal)} more for free shipping`}
          </p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search oils, honey, jaggery…"
              aria-label="Search products"
              className="h-11 w-full rounded-xl border border-line bg-white pr-9 pl-10 text-base outline-none focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/10 md:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-page"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div
            className="mt-2 flex gap-1.5"
            role="group"
            aria-label="Browse by category"
          >
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={chip === c.id}
                onClick={() => setChip(c.id)}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-xs font-semibold transition-colors",
                  chip === c.id
                    ? "border-forest bg-co-brand-soft text-forest"
                    : "border-line text-ink-muted hover:border-co-border-strong",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5"
          data-lenis-prevent=""
        >
          {error && (
            <p className="mt-3 rounded-xl bg-co-danger/10 px-3 py-2 text-sm text-co-danger">
              {error} Please try again.
            </p>
          )}
          {browsing ? (
            filtered.length ? (
              <ul className="divide-y divide-line">
                {filtered.map((p) => (
                  <Row
                    key={p.handle}
                    p={p}
                    onAdded={(id) => added.current.add(id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-12 text-center text-sm text-ink-muted">
                No match. Try &lsquo;mustard&rsquo; or &lsquo;honey&rsquo;.
              </p>
            )
          ) : (
            <>
              {picks.length > 0 && (
                <>
                  <h3 className="pt-4 pb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">
                    Goes well with your order
                  </h3>
                  <ul className="divide-y divide-line">
                    {picks.map((p) => (
                      <Row
                        key={p.handle}
                        p={p}
                        onAdded={(id) => added.current.add(id)}
                      />
                    ))}
                  </ul>
                </>
              )}
              <h3 className="pt-5 pb-1 text-xs font-bold tracking-wide text-ink-muted uppercase">
                All products
              </h3>
              <ul className="divide-y divide-line pb-4">
                {available
                  .filter((p) => !picks.includes(p))
                  .map((p) => (
                    <Row
                      key={p.handle}
                      p={p}
                      onAdded={(id) => added.current.add(id)}
                    />
                  ))}
              </ul>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-line bg-white px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            className="flex items-baseline justify-between"
            aria-live="polite"
          >
            <span className="text-sm text-ink-muted">
              {cart?.totalQuantity ?? 0} item
              {cart?.totalQuantity === 1 ? "" : "s"}
            </span>
            <span className="text-xl font-extrabold text-ink tabular-nums">
              <NumberFlow value={subtotal} format={NF} locales="en-IN" />
            </span>
          </div>
          {mrpTotal > subtotal && (
            <p className="text-right text-xs font-semibold text-co-success">
              You save {formatMoney(mrpTotal - subtotal)}
            </p>
          )}
          <SheetClose asChild>
            <button
              type="button"
              className="mt-3 h-12 w-full rounded-xl bg-forest text-[15px] font-bold text-white transition-colors hover:bg-forest-mid"
            >
              Done, back to checkout
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  p,
  onAdded,
}: {
  p: CatalogItem;
  onAdded: (variantId: string) => void;
}) {
  const { cart, add, update, remove } = useCart();
  const sizes = p.variants.filter((v) => v.available);
  const inCartVariant = sizes.find((v) =>
    cart?.lines.some((l) => l.variant.id === v.id),
  );
  const fallback =
    sizes.find((v) => v.title === p.defaultSize) ??
    [...sizes].sort((a, b) => a.size - b.size)[0];
  const [picked, setPicked] = useState<string | null>(null);
  const v = sizes.find((x) => x.id === picked) ?? inCartVariant ?? fallback;
  const line = cart?.lines.find((l) => l.variant.id === v?.id);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  if (!v) return null;
  const off =
    v.mrp && v.mrp > v.price
      ? Math.round(((v.mrp - v.price) / v.mrp) * 100)
      : 0;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-line">
        {p.image && (
          <Image
            src={cutoutUrl(p.image.url)}
            alt={p.image.alt}
            width={56}
            height={56}
            className="size-12 object-contain"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" title={`${p.title} ${p.titleHi}`}>
          <span className="font-semibold text-ink">{shortTitle(p.title)}</span>
          {p.titleHi && (
            <span className="ml-1.5 text-xs text-co-accent-ink">
              {p.titleHi}
            </span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {sizes.length > 1 ? (
            <select
              value={v.id}
              onChange={(e) => setPicked(e.target.value)}
              aria-label={`Size for ${p.title}`}
              className="h-7 rounded-full border border-line bg-white pr-6 pl-2.5 text-xs text-ink outline-none focus-visible:border-forest"
            >
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-ink-muted">{v.title}</span>
          )}
          <span className="text-sm font-semibold text-ink tabular-nums">
            {formatMoney(v.price)}
          </span>
          {off > 0 && (
            <>
              <s className="text-xs text-ink-muted/70 tabular-nums">
                {formatMoney(v.mrp!)}
              </s>
              <span className="text-[11px] font-bold text-co-success">
                {off}% off
              </span>
            </>
          )}
        </div>
      </div>
      {line ? (
        <span
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border-[1.5px] transition-colors",
            flash ? "border-co-success bg-co-success-soft" : "border-forest/40",
          )}
        >
          <button
            type="button"
            aria-label={`Decrease ${p.title}`}
            disabled={busy}
            onClick={() =>
              run(() =>
                line.quantity <= 1
                  ? remove(line.id)
                  : update(line.id, line.quantity - 1),
              )
            }
            className="grid size-8 place-items-center rounded-full text-ink-muted hover:text-ink"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-bold tabular-nums">
            {flash ? (
              <Check
                className="mx-auto size-4 text-co-success"
                strokeWidth={3}
              />
            ) : (
              line.quantity
            )}
          </span>
          <button
            type="button"
            aria-label={`Increase ${p.title}`}
            disabled={busy}
            onClick={() => run(() => update(line.id, line.quantity + 1))}
            className="grid size-8 place-items-center rounded-full text-ink-muted hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await add(v.id, 1);
              onAdded(v.id);
              setFlash(true);
              setTimeout(() => setFlash(false), 900);
            })
          }
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-forest px-3.5 text-sm font-semibold text-forest transition-colors hover:bg-co-brand-soft disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}{" "}
          Add
        </button>
      )}
    </li>
  );
}
