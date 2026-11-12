"use client";

import { useEffect, useState } from "react";
import { PickCard } from "@/components/home/PickCard";
import type { PickProduct } from "@/components/home/pickProduct";
import { SectionHeader } from "@/components/ui/SectionHeader";

const KEY = "smp_recently_viewed";
const MAX = 8;

/** Records this product and shows the others the shopper looked at (this browser only). */
export function RecentlyViewed({ current, products }: { current?: string; products: PickProduct[] }) {
  const [handles, setHandles] = useState<string[]>([]);
  useEffect(() => {
    let prev: string[] = [];
    try {
      prev = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (!Array.isArray(prev)) prev = [];
      // Product pages record the visit; listings only read.
      if (current) localStorage.setItem(KEY, JSON.stringify([current, ...prev.filter((h) => h !== current)].slice(0, MAX)));
    } catch {
      /* storage blocked: nothing to show */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from localStorage after mount
    setHandles(prev.filter((h) => h !== current));
  }, [current]);

  const list = handles.map((h) => products.find((p) => p.handle === h)).filter((p): p is PickProduct => Boolean(p)).slice(0, 4);
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 pt-10 pb-14 md:px-8 md:pt-14 md:pb-20" aria-labelledby="recent-h">
      <SectionHeader id="recent-h" eyebrow="हाल ही में देखे" title="Recently viewed" />
      {/* Phones: one swipe row (next card peeks); md+: grid. */}
      <ul className="no-scrollbar -mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.handle} className="w-[47%] shrink-0 snap-start md:w-auto">
            <PickCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Product pages: record the visit only (renders nothing). Listings show the list via <RecentlyViewed>. */
export function RecordView({ handle }: { handle: string }) {
  useEffect(() => {
    try {
      const prev: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      const list = Array.isArray(prev) ? (prev as string[]) : [];
      localStorage.setItem(KEY, JSON.stringify([handle, ...list.filter((h) => h !== handle)].slice(0, MAX)));
    } catch {
      /* storage blocked: nothing to record */
    }
  }, [handle]);
  return null;
}
