"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  FolderMinus,
  FolderPlus,
  ImageOff,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { bulkProductsAction } from "@/lib/catalog-actions";
import type { BulkAction } from "@/lib/server/catalog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "./order/ConfirmAction";

export type ProductRow = {
  handle: string;
  title: string;
  titleHi: string;
  image: string;
  hasPhoto: boolean;
  swatch: string | null;
  category: string;
  status: "active" | "draft" | "archived";
  sizes: { title: string; enabled: boolean; stock: number | null }[];
  from: number;
  to: number;
  stock: number | null;
  lowSizes: number;
  missingPrice: boolean;
  missingTax: boolean;
};

const STATUS = {
  active: { label: "Active", cls: "bg-forest/10 text-forest-fg", dot: "bg-forest-fg" },
  draft: { label: "Draft", cls: "bg-warm-strong text-sale", dot: "bg-mustard" },
  archived: { label: "Archived", cls: "bg-ink/[0.07] text-ink-muted", dot: "bg-ink-muted/50" },
};
const CATEGORY: Record<string, string> = { oil: "Oil", honey: "Honey", sweetener: "Sweetener" };

const checkbox = "size-4 cursor-pointer rounded accent-[var(--color-forest)]";

export function ProductsTable({ rows, collections }: { rows: ProductRow[]; collections: { handle: string; title: string }[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => sel.has(r.handle));
  const some = sel.size > 0 && !all;

  const toggle = (h: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(h)) n.delete(h);
      else n.add(h);
      return n;
    });

  function apply(handles: string[], action: BulkAction, label: string) {
    if (!handles.length) return;
    start(async () => {
      setMsg(null);
      try {
        const n = await bulkProductsAction(handles, action);
        setMsg({ ok: true, text: `${label} · ${n} product${n === 1 ? "" : "s"}` });
        setSel(new Set());
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message });
      }
    });
  }
  const bulk = (action: BulkAction, label: string) => apply([...sel], action, label);

  const price = (r: ProductRow) =>
    !r.from ? <span className="text-ink-muted">No price</span> : r.to > r.from ? `${formatMoney(r.from)} – ${formatMoney(r.to)}` : formatMoney(r.from);

  const stockCell = (r: ProductRow) =>
    r.stock === null ? (
      <span className="text-ink-muted">Not tracked</span>
    ) : (
      <span className="flex flex-col">
        <span className={cn("font-semibold tabular-nums", r.stock === 0 ? "text-red-700" : "text-ink")}>{r.stock} in stock</span>
        {r.lowSizes > 0 && <span className="text-xs text-sale">{r.lowSizes} size{r.lowSizes === 1 ? "" : "s"} low</span>}
      </span>
    );

  const rowMenu = (r: ProductRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Actions for ${r.title}`} className="relative z-10 grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={`/admin/products/edit?handle=${r.handle}`}>
            <Pencil /> Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/products/${r.handle}`} target="_blank">
            <ExternalLink /> View on store
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {r.status !== "active" && (
          <DropdownMenuItem onSelect={() => apply([r.handle], { type: "status", status: "active" }, "Published")}>
            <Eye /> Publish
          </DropdownMenuItem>
        )}
        {r.status === "active" && (
          <DropdownMenuItem onSelect={() => apply([r.handle], { type: "status", status: "draft" }, "Hidden")}>
            <EyeOff /> Hide (draft)
          </DropdownMenuItem>
        )}
        {r.status !== "archived" && (
          <DropdownMenuItem onSelect={() => apply([r.handle], { type: "status", status: "archived" }, "Archived")}>
            <Archive /> Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="relative">
      {msg && (
        <p className={cn("mb-3 rounded-xl px-4 py-2.5 text-sm", msg.ok ? "bg-forest/10 text-forest-fg" : "bg-red-50 text-red-800")} role="status">
          {msg.text}
        </p>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-muted">
            <tr>
              <th className="w-12 py-3 pl-5">
                <input
                  type="checkbox"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.handle)))}
                  className={checkbox}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="py-3 pr-4 font-medium">Product</th>
              <th className="py-3 pr-4 font-medium">Sizes</th>
              <th className="py-3 pr-4 font-medium">Price</th>
              <th className="py-3 pr-4 font-medium">Stock</th>
              <th className="py-3 pr-4 font-medium">Status</th>
              <th className="w-12 py-3 pr-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.handle} className={cn("group relative transition-colors hover:bg-subtle", sel.has(r.handle) && "bg-forest/5 hover:bg-forest/5")}>
                <td className="py-3 pl-5">
                  <input type="checkbox" checked={sel.has(r.handle)} onChange={() => toggle(r.handle)} className={cn(checkbox, "relative z-10")} aria-label={`Select ${r.title}`} />
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <Thumb r={r} />
                    <div className="min-w-0">
                      <Link href={`/admin/products/edit?handle=${r.handle}`} className="block truncate font-semibold text-ink after:absolute after:inset-0 group-hover:text-forest-fg">
                        {r.title}
                      </Link>
                      <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted">
                        {r.titleHi && <span lang="hi">{r.titleHi}</span>}
                        {r.titleHi && <span aria-hidden>·</span>}
                        {CATEGORY[r.category] ?? r.category}
                        {r.missingTax && <span className="rounded-full bg-warm-strong px-1.5 text-[10px] font-semibold text-sale">No HSN/GST</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {r.sizes.slice(0, 4).map((s) => (
                      <span
                        key={s.title}
                        title={!s.enabled ? "Not on sale" : s.stock === 0 ? "Out of stock" : undefined}
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                          !s.enabled ? "border-dashed border-line text-ink-muted/60 line-through" : s.stock === 0 ? "border-red-200 text-red-700" : "border-line text-ink",
                        )}
                      >
                        {s.title}
                      </span>
                    ))}
                    {r.sizes.length > 4 && <span className="px-1 text-[11px] text-ink-muted">+{r.sizes.length - 4}</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-4 font-semibold tabular-nums text-forest-text">
                  {price(r)}
                  {r.missingPrice && r.from > 0 && <span className="block text-xs font-normal text-sale">Some sizes unpriced</span>}
                </td>
                <td className="whitespace-nowrap py-3 pr-4">{stockCell(r)}</td>
                <td className="py-3 pr-4">
                  <StatusPill status={r.status} />
                </td>
                <td className="py-3 pr-4 text-right">{rowMenu(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        <label className="flex items-center gap-2 px-1 text-sm text-ink-muted">
          <input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.handle)))} className={checkbox} />
          Select all
        </label>
        {rows.map((r) => (
          <article key={r.handle} className={cn("rounded-2xl border border-line bg-surface p-3.5", sel.has(r.handle) && "border-forest bg-forest/5")}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={sel.has(r.handle)} onChange={() => toggle(r.handle)} className={cn(checkbox, "mt-1 size-5 shrink-0")} aria-label={`Select ${r.title}`} />
              <Link href={`/admin/products/edit?handle=${r.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Thumb r={r} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{r.title}</span>
                  <span className="block truncate text-xs text-ink-muted" lang="hi">{r.titleHi || CATEGORY[r.category]}</span>
                </span>
              </Link>
              {rowMenu(r)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
              <span className="font-semibold tabular-nums text-forest-text">{price(r)}</span>
              <span className="text-xs">{stockCell(r)}</span>
              <StatusPill status={r.status} />
            </div>
          </article>
        ))}
      </div>

      {/* Floating bulk bar */}
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-5 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-forest-deep p-2.5 pl-4 text-sm text-white shadow-2xl ring-1 ring-white/10 md:left-[calc(var(--sidebar-width,16rem)+1rem)]"
            role="toolbar"
            aria-label="Bulk actions"
          >
            <span className="mr-1 flex items-center gap-2 font-semibold">
              {pending && <Loader2 className="size-4 animate-spin" />}
              {sel.size} selected
            </span>
            <BarButton disabled={pending} onClick={() => bulk({ type: "status", status: "active" }, "Published")}>
              <Eye className="size-4" /> Publish
            </BarButton>
            <BarButton disabled={pending} onClick={() => bulk({ type: "status", status: "draft" }, "Hidden")}>
              <EyeOff className="size-4" /> Hide
            </BarButton>
            <BarButton disabled={pending} onClick={() => bulk({ type: "status", status: "archived" }, "Archived")}>
              <Archive className="size-4" /> Archive
            </BarButton>
            <DropdownMenu>
              <DropdownMenuTrigger disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 font-medium transition-colors hover:bg-white/20">
                Collections <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderPlus /> Add to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuLabel className="text-xs text-ink-muted">Add {sel.size} to…</DropdownMenuLabel>
                    {collections.map((c) => (
                      <DropdownMenuItem key={c.handle} onSelect={() => bulk({ type: "addToCollection", collection: c.handle }, `Added to ${c.title}`)}>
                        {c.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderMinus /> Remove from
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {collections.map((c) => (
                      <DropdownMenuItem key={c.handle} onSelect={() => bulk({ type: "removeFromCollection", collection: c.handle }, `Removed from ${c.title}`)}>
                        {c.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmAction
              trigger={
                <button type="button" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600/90 px-3 font-medium transition-colors hover:bg-red-600 disabled:opacity-50">
                  <Trash2 className="size-4" /> Delete
                </button>
              }
              title={`Delete ${sel.size} product${sel.size === 1 ? "" : "s"}?`}
              description="Their photos are removed from the site too. Past orders keep their item details. This can't be undone. Archive instead if you may sell it again."
              confirmLabel="Delete for good"
              destructive
              onConfirm={() => bulk({ type: "delete" }, "Deleted")}
            />
            <button type="button" onClick={() => setSel(new Set())} aria-label="Clear selection" className="ml-auto grid size-9 place-items-center rounded-full hover:bg-white/10">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Thumb({ r }: { r: ProductRow }) {
  return (
    <span className="relative size-12 shrink-0">
      <span className="block size-12 overflow-hidden rounded-xl bg-subtle ring-1 ring-line">
        <Image src={r.image} alt="" width={48} height={48} className="size-12 object-cover" unoptimized={r.image.endsWith(".svg")} />
      </span>
      {r.swatch && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-surface" style={{ background: r.swatch }} />}
      {!r.hasPhoto && (
        <span title="No real photo yet" className="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full bg-warm-strong text-sale ring-2 ring-surface">
          <ImageOff className="size-3" />
        </span>
      )}
    </span>
  );
}

function StatusPill({ status }: { status: ProductRow["status"] }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.cls)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function BarButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 font-medium transition-colors hover:bg-white/20 disabled:opacity-50">
      {children}
    </button>
  );
}
