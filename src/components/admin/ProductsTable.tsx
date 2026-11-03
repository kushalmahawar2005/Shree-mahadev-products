"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkProductsAction } from "@/lib/catalog-actions";
import type { BulkAction } from "@/lib/server/catalog";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type ProductRow = {
  handle: string;
  title: string;
  titleHi: string;
  image: string;
  category: string;
  status: "active" | "draft" | "archived";
  variants: number;
  from: number;
  stock: number | null;
  collections: string[];
};

const STATUS_TONE = { active: "bg-forest/10 text-forest", draft: "bg-mustard/20 text-sale", archived: "bg-black/5 text-ink-muted" };

export function ProductsTable({ rows, collections }: { rows: ProductRow[]; collections: { handle: string; title: string }[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => sel.has(r.handle));

  const toggle = (h: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(h)) n.delete(h);
      else n.add(h);
      return n;
    });

  function apply(action: BulkAction, label: string) {
    const handles = [...sel];
    if (!handles.length) return;
    if (action.type === "delete" && !window.confirm(`Delete ${handles.length} product(s)? Their photos are removed from the site too. Past orders are kept.`)) return;
    start(async () => {
      setMsg(null);
      try {
        const n = await bulkProductsAction(handles, action);
        setMsg({ ok: true, text: `${label}: ${n} updated` });
        setSel(new Set());
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
    });
  }

  return (
    <div>
      {sel.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-forest p-3 text-sm text-white shadow-lg">
          <span className="mr-1 font-semibold">{sel.size} selected</span>
          <button disabled={pending} onClick={() => apply({ type: "status", status: "active" }, "Set active")} className="min-h-9 rounded-full bg-white/15 px-3 hover:bg-white/25">
            Set active
          </button>
          <button disabled={pending} onClick={() => apply({ type: "status", status: "draft" }, "Set draft")} className="min-h-9 rounded-full bg-white/15 px-3 hover:bg-white/25">
            Set draft (hide)
          </button>
          <button disabled={pending} onClick={() => apply({ type: "status", status: "archived" }, "Archived")} className="min-h-9 rounded-full bg-white/15 px-3 hover:bg-white/25">
            Archive
          </button>
          <select
            disabled={pending}
            value=""
            onChange={(e) => {
              const [op, handle] = e.target.value.split(":");
              if (!handle) return;
              const col = collections.find((c) => c.handle === handle)?.title ?? handle;
              apply(
                op === "add" ? { type: "addToCollection", collection: handle } : { type: "removeFromCollection", collection: handle },
                op === "add" ? `Added to ${col}` : `Removed from ${col}`,
              );
            }}
            className="min-h-9 rounded-full bg-white/15 px-3 text-white [&>*]:text-ink"
            aria-label="Collection action"
          >
            <option value="">Collection…</option>
            <optgroup label="Add to">
              {collections.map((c) => (
                <option key={`a${c.handle}`} value={`add:${c.handle}`}>
                  {c.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Remove from">
              {collections.map((c) => (
                <option key={`r${c.handle}`} value={`remove:${c.handle}`}>
                  {c.title}
                </option>
              ))}
            </optgroup>
          </select>
          <button disabled={pending} onClick={() => apply({ type: "delete" }, "Deleted")} className="min-h-9 rounded-full bg-red-600/90 px-3 hover:bg-red-600">
            Delete
          </button>
          <button onClick={() => setSel(new Set())} className="ml-auto min-h-9 px-2 underline">
            Clear
          </button>
        </div>
      )}
      {msg && <p className={cn("mb-3 text-sm", msg.ok ? "text-forest" : "text-sale")}>{msg.text}</p>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-khaki-soft/60 text-ink-muted">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.handle)))}
                  className="size-4 accent-[var(--color-forest)]"
                  aria-label="Select all on this page"
                />
              </th>
              <th className="p-3 font-semibold">Product</th>
              <th className="p-3 font-semibold">Category</th>
              <th className="p-3 font-semibold">Sizes</th>
              <th className="p-3 font-semibold">From</th>
              <th className="p-3 font-semibold">Stock</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.handle} className={cn(sel.has(r.handle) && "bg-khaki-soft/40")}>
                <td className="p-3">
                  <input type="checkbox" checked={sel.has(r.handle)} onChange={() => toggle(r.handle)} className="size-4 accent-[var(--color-forest)]" aria-label={`Select ${r.title}`} />
                </td>
                <td className="p-3">
                  <Link href={`/admin/products/edit?handle=${r.handle}`} className="flex items-center gap-3">
                    <Image src={r.image} alt="" width={48} height={48} className="size-12 rounded-lg bg-khaki-soft object-cover" unoptimized={r.image.endsWith(".svg")} />
                    <span>
                      <span className="block font-semibold text-forest-text hover:underline">{r.title}</span>
                      <span className="text-ink-muted">{r.titleHi}</span>
                    </span>
                  </Link>
                </td>
                <td className="p-3 capitalize">{r.category}</td>
                <td className="p-3">{r.variants}</td>
                <td className="p-3">{r.from ? formatMoney(r.from) : <span className="text-ink-muted">No price</span>}</td>
                <td className="p-3">{r.stock === null ? <span className="text-ink-muted">Not tracked</span> : r.stock}</td>
                <td className="p-3">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", STATUS_TONE[r.status])}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
