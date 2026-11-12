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
    <section className="mx-auto max-w-7xl px-6 pb-14 md:px-8 md:pb-20" aria-labelledby="recent-h">
      <SectionHeader id="recent-h" eyebrow="हाल ही में देखे" title="Recently viewed" />
      <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.handle}>
            <PickCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
