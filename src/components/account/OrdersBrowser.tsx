"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Loader2, PackageSearch, Search, ShoppingBag, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Skeleton } from "@/components/shadcn/skeleton";
import type { AccountOrder, OrderRange, OrderTab } from "@/lib/server/account";
import { cn } from "@/lib/utils/cn";
import { OrderCard, type ProductInfo } from "./OrderCard";
import { Usuals, type Usual } from "./Usuals";

type Counts = Record<OrderTab, number>;
export type OrdersPage = {
  orders: AccountOrder[];
  nextCursor: number | null;
  counts: Counts;
};

const TABS: { id: OrderTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];
const RANGES: { id: OrderRange; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "30d", label: "Last 30 days" },
  { id: "6m", label: "Last 6 months" },
  { id: "year", label: String(new Date().getFullYear()) },
];
const EMPTY: Record<OrderTab, { title: string; text: string }> = {
  all: { title: "No orders yet", text: "" },
  active: {
    title: "No active orders",
    text: "Orders on their way, or waiting for payment, show up here.",
  },
  delivered: {
    title: "No delivered orders yet",
    text: "Once an order reaches you, you can reorder or download its invoice here.",
  },
  cancelled: {
    title: "Nothing cancelled",
    text: "Cancelled, failed and refunded orders show up here.",
  },
};

function buildQuery(f: { tab: OrderTab; q: string; range: OrderRange }, cursor?: number) {
  const sp = new URLSearchParams();
  if (f.tab !== "all") sp.set("status", f.tab);
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.range !== "all") sp.set("range", f.range);
  if (cursor) sp.set("cursor", String(cursor));
  return sp.toString();
}

/** My orders: status tabs with counts, search, date filter and cursor "Load more" (via /api/account/orders). */
export function OrdersBrowser({
  initial,
  initialFilters,
  info,
  bestsellers,
}: {
  initial: OrdersPage;
  initialFilters: { tab: OrderTab; q: string; range: OrderRange };
  info: ProductInfo;
  bestsellers: Usual[];
}) {
  const reduce = useReducedMotion();
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters.q);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const req = useRef(0);
  const first = useRef(true);

  const load = useCallback(async (f: typeof filters) => {
    const id = ++req.current;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/account/orders?${buildQuery(f)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as OrdersPage;
      if (id === req.current) setData(json);
    } catch {
      if (id === req.current) setError(true);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, []);

  // Refetch + mirror filters in the URL (no server round-trip) whenever they change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const qs = buildQuery(filters);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    void load(filters);
  }, [filters, load]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (query === filters.q) return;
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: query })), 300);
    return () => clearTimeout(t);
  }, [query, filters.q]);

  const loadMore = async () => {
    if (!data.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/account/orders?${buildQuery(filters, data.nextCursor)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as Omit<OrdersPage, "counts">;
      setData((d) => ({
        ...d,
        orders: [...d.orders, ...json.orders.filter((o) => !d.orders.some((x) => x.id === o.id))],
        nextCursor: json.nextCursor,
      }));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = filters.q.trim() !== "" || filters.range !== "all";
  const noOrdersAtAll = !filtered && data.counts.all === 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-3 rounded-3xl border border-line bg-white p-3 shadow-co-card sm:p-4">
        <div
          role="tablist"
          aria-label="Order status"
          className="flex w-full snap-x gap-0.5 overflow-x-auto rounded-full border border-line bg-ivory p-1 [scrollbar-width:none] sm:w-fit"
        >
          {TABS.map((t) => {
            const on = filters.tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilters((f) => ({ ...f, tab: t.id }))}
                className={cn(
                  "relative inline-flex h-9 flex-1 shrink-0 snap-start items-center justify-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-forest/30 sm:flex-none sm:px-4",
                  on ? "text-forest-text" : "text-ink-muted hover:text-ink",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="orders-tab"
                    transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.15, duration: 0.4 }}
                    className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(7,47,27,0.08),0_2px_8px_-2px_rgba(7,47,27,0.10)] ring-1 ring-line"
                  />
                )}
                <span className="relative">{t.label}</span>
                <span
                  className={cn(
                    "relative grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-none font-bold tabular-nums transition-colors duration-200",
                    on ? "bg-forest text-white" : data.counts[t.id] ? "bg-forest/10 text-forest-text" : "bg-black/[0.04] text-ink-muted/70",
                  )}
                >
                  {data.counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by order ID or product"
              className="h-12 w-full rounded-xl border border-line bg-white pr-10 pl-10 text-base text-ink outline-none placeholder:text-ink-muted focus-visible:border-forest sm:h-11 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {loading && query ? (
              <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-muted" />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-page hover:text-ink"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
          <Select
            value={filters.range}
            onValueChange={(v) => setFilters((f) => ({ ...f, range: v as OrderRange }))}
          >
            <SelectTrigger
              aria-label="Date range"
              className="h-12! w-full rounded-xl border-line bg-white text-base sm:h-11! sm:w-48 sm:text-sm"
            >
              <CalendarDays className="size-4 text-ink-muted" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </div>
        ) : error && !data.orders.length ? (
          <Empty
            title="Couldn't load your orders"
            text="Check your connection and try again."
          >
            <button type="button" onClick={() => load(filters)} className={primaryBtn}>
              Try again
            </button>
          </Empty>
        ) : noOrdersAtAll ? (
          <FirstOrder bestsellers={bestsellers} />
        ) : !data.orders.length ? (
          filtered ? (
            <Empty
              title="No orders match"
              text={`Nothing for “${filters.q || RANGES.find((r) => r.id === filters.range)?.label}” in ${TABS.find((t) => t.id === filters.tab)?.label.toLowerCase()} orders.`}
            >
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters((f) => ({ ...f, q: "", range: "all" }));
                }}
                className={secondaryBtn}
              >
                Clear filters
              </button>
            </Empty>
          ) : (
            <Empty title={EMPTY[filters.tab].title} text={EMPTY[filters.tab].text}>
              <Link href="/shop" className={secondaryBtn}>
                <ShoppingBag className="size-4" /> Shop products
              </Link>
            </Empty>
          )
        ) : (
          <ul className="space-y-4">
            <AnimatePresence initial={false}>
              {data.orders.map((o, i) => (
                <motion.li
                  key={o.id}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(i % 10, 5) * 0.04 }}
                >
                  <OrderCard
                    order={o}
                    info={info}
                    variant="compact"
                    onChange={() => load(filters)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {!loading && data.nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={cn(secondaryBtn, "max-sm:w-full")}
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" />}
            Load more orders
          </button>
        </div>
      )}
    </div>
  );
}

const primaryBtn =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid";
const secondaryBtn =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink hover:border-co-border-strong disabled:opacity-60";

function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-co-border-strong bg-white px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-co-accent-soft text-co-accent">
        <PackageSearch className="size-6" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-lg font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Zero orders ever: a warm nudge + bestseller quick-add instead of a blank list. */
function FirstOrder({ bestsellers }: { bestsellers: Usual[] }) {
  return (
    <div className="space-y-5 rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-8">
      <div className="flex flex-col items-center text-center">
        <OilDrop />
        <p className="mt-4 font-hindi text-base text-co-accent-ink" lang="hi">
          पहला ऑर्डर
        </p>
        <p className="text-xl font-bold text-ink md:text-2xl">
          Your first wood-pressed order is waiting
        </p>
        <p className="mt-1 max-w-md text-sm text-ink-muted">
          Slow-pressed in Bijainagar, packed fresh the week you order. Start with a family favourite.
        </p>
      </div>
      {bestsellers.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-ink">Bestsellers</p>
          <Usuals items={bestsellers} />
        </div>
      )}
      <div className="flex justify-center">
        <Link href="/shop" className={cn(primaryBtn, "max-sm:w-full")}>
          <ShoppingBag className="size-4" /> Shop all products
        </Link>
      </div>
    </div>
  );
}

/** Hand-drawn oil drop for the empty state (small inline SVG, theme tokens only). */
function OilDrop() {
  return (
    <svg viewBox="0 0 96 96" className="size-24" aria-hidden>
      <circle cx="48" cy="52" r="38" className="fill-co-accent-soft" />
      <path
        d="M48 18c10 15 22 27 22 41a22 22 0 0 1-44 0c0-14 12-26 22-41Z"
        className="fill-co-accent"
      />
      <path
        d="M38 60a10 10 0 0 0 10 10"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-white/80"
      />
    </svg>
  );
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 md:p-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-line pt-4">
        <Skeleton className="h-11 w-32 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
    </div>
  );
}
