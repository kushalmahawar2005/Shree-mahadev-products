"use client";

import { unwrap } from "@/lib/action-result";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  Clock,
  History,
  Loader2,
  Minus,
  PackageX,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { adjustStockAction, inventoryLogAction, setLowStockThresholdAction } from "@/lib/inventory-actions";
import type { InventoryRow } from "@/lib/server/inventory";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "./order/ConfirmAction";

type Filter = "all" | "low" | "out" | "untracked";
type LogEntry = Extract<Awaited<ReturnType<typeof inventoryLogAction>>, { ok: true }>["data"][number];
type Mode = "add" | "remove" | "set";

const REASON_LABEL: Record<string, string> = {
  order: "Order placed",
  release: "Payment not completed",
  restock: "Order cancelled",
  rto_return: "RTO received back",
  restock_manual: "Restock",
  damaged: "Damaged / lost",
  correction: "Stock count",
};

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const when = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(String(d).replace(" ", "T") + "+05:30"));

export function InventoryTable({ rows, threshold }: { rows: InventoryRow[]; threshold: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ row: InventoryRow; log: LogEntry[] | null } | null>(null);

  const isLow = (r: InventoryRow) => r.stock !== null && r.stock > 0 && r.stock <= threshold;
  const isOut = (r: InventoryRow) => r.stock !== null && r.stock <= 0;
  const counts = {
    all: rows.length,
    low: rows.filter(isLow).length,
    out: rows.filter(isOut).length,
    untracked: rows.filter((r) => r.stock === null).length,
  };
  const tracked = rows.filter((r) => r.stock !== null);
  const units = tracked.reduce((s, r) => s + Math.max(0, r.stock ?? 0), 0);
  const value = tracked.reduce((s, r) => s + Math.max(0, r.stock ?? 0) * r.price, 0);
  const held = rows.reduce((s, r) => s + r.held, 0);
  const waiting = rows.reduce((s, r) => s + r.waiting, 0);

  const groups = useMemo(() => {
    const shown = rows.filter((r) => {
      if (filter === "low" && !isLow(r)) return false;
      if (filter === "out" && !isOut(r)) return false;
      if (filter === "untracked" && r.stock !== null) return false;
      return !q || `${r.productTitle} ${r.size} ${r.sku ?? ""}`.toLowerCase().includes(q.toLowerCase());
    });
    const map = new Map<string, InventoryRow[]>();
    for (const r of shown) map.set(r.handle, [...(map.get(r.handle) ?? []), r]);
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isLow/isOut depend only on threshold
  }, [rows, filter, q, threshold]);

  const run = (fn: () => Promise<unknown>, ok: string, after?: () => void) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
        setMsg({ ok: true, text: ok });
        after?.();
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message.replace(/^\[.*?\]\s*/, "") || "Could not save" });
      }
    });

  async function openHistory(row: InventoryRow) {
    setHistory({ row, log: null });
    try {
      const log = unwrap(await inventoryLogAction(row.variantKey));
      setHistory({ row, log });
    } catch (error) {
      setHistory(null);
      setMsg({ ok: false, text: (error as Error).message || "Could not load stock history" });
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Stock summary">
        <Stat icon={Boxes} label="Units in stock" value={units.toLocaleString("en-IN")} note={`${tracked.length} of ${rows.length} sizes tracked`} />
        <Stat icon={Check} label="Stock value" value={`₹${value.toLocaleString("en-IN")}`} note="at selling price" />
        <Stat icon={Clock} label="Held in checkout" value={String(held)} note="released after 30 min if unpaid" />
        <Stat icon={Bell} label="Back-in-stock requests" value={String(waiting)} note="customers waiting" tone={waiting ? "warn" : undefined} />
      </section>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap rounded-full border border-line bg-surface p-1">
          {(
            [
              ["all", "All sizes", null],
              ["low", "Low", AlertTriangle],
              ["out", "Out of stock", PackageX],
              ["untracked", "Not tracked", null],
            ] as const
          ).map(([f, label, Icon]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                filter === f ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg",
              )}
            >
              {Icon && <Icon className="size-3.5" />}
              {label}
              <span className={cn("text-[11px]", filter === f ? "text-white/70" : "text-ink-muted/70")}>{counts[f]}</span>
            </button>
          ))}
        </div>
        <ThresholdControl threshold={threshold} busy={busy} onSave={(n) => run(async () => unwrap(await setLowStockThresholdAction(n)), `Low stock alert set to ${n}`)} />
        <div className="relative lg:ml-auto lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, size or SKU"
            aria-label="Search inventory"
            className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p className={cn("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm", msg.ok ? "bg-forest/10 text-forest-fg" : "bg-red-50 text-red-800")} role="status">
          {msg.ok ? <Check className="size-4" /> : <AlertTriangle className="size-4" />} {msg.text}
        </p>
      )}

      {/* Groups */}
      {groups.length === 0 ? (
        <div className={cn(card, "px-6 py-14 text-center")}>
          <Boxes className="mx-auto size-8 text-ink-muted" />
          <p className="mt-3 font-semibold text-forest-text">{rows.length ? "No sizes match" : "No product sizes yet"}</p>
          <p className="mt-1 text-sm text-ink-muted">{rows.length ? "Try another filter or search." : "Add a product to start tracking stock."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((sizes) => {
            const head = sizes[0];
            const open = !collapsed.has(head.handle);
            const t = sizes.filter((s) => s.stock !== null);
            const total = t.reduce((s, r) => s + Math.max(0, r.stock ?? 0), 0);
            const alerts = sizes.filter((s) => isLow(s) || isOut(s)).length;
            return (
              <section key={head.handle} className={cn(card, "overflow-hidden", head.productStatus !== "active" && "opacity-70")}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => {
                      const n = new Set(c);
                      if (n.has(head.handle)) n.delete(head.handle);
                      else n.add(head.handle);
                      return n;
                    })
                  }
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle sm:px-5"
                >
                  <Thumb image={head.image} swatch={head.swatch} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{head.productTitle}</span>
                    <span className="block text-xs text-ink-muted">
                      {sizes.length} size{sizes.length === 1 ? "" : "s"}
                      {t.length ? ` · ${total} units` : " · not tracked"}
                      {head.productStatus !== "active" && ` · ${head.productStatus}`}
                    </span>
                  </span>
                  {alerts > 0 && (
                    <span className="hidden items-center gap-1 rounded-full bg-warm-strong px-2.5 py-1 text-xs font-semibold text-sale sm:inline-flex">
                      <AlertTriangle className="size-3.5" /> {alerts} need{alerts === 1 ? "s" : ""} restock
                    </span>
                  )}
                  <ChevronDown className={cn("size-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <ul className="divide-y divide-line border-t border-line">
                    {sizes.map((r) => (
                      <SizeRow key={r.variantKey} r={r} threshold={threshold} busy={busy} run={run} onHistory={() => void openHistory(r)} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* History drawer */}
      <Sheet open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <SheetContent className="w-full border-line bg-surface sm:max-w-md">
          {history && (
            <>
              <SheetHeader>
                <SheetTitle className="text-forest-text">
                  {history.row.productTitle} · {history.row.size}
                </SheetTitle>
                <SheetDescription>
                  {history.row.stock === null ? "Stock not tracked" : `${history.row.stock} in stock now`}
                  {history.row.sku ? ` · ${history.row.sku}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="overflow-y-auto px-4 pb-6">
                {history.log === null ? (
                  <p className="flex items-center gap-2 text-sm text-ink-muted">
                    <Loader2 className="size-4 animate-spin" /> Loading history…
                  </p>
                ) : history.log.length === 0 ? (
                  <p className="rounded-xl bg-subtle p-4 text-sm text-ink-muted">No stock changes yet.</p>
                ) : (
                  <ol className="relative space-y-4 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
                    {history.log.map((l, i) => (
                      <li key={i} className="relative">
                        <span aria-hidden className={cn("absolute -left-6 top-1 size-[15px] rounded-full border-2 border-surface", l.delta < 0 ? "bg-mustard" : "bg-forest-fg")} />
                        <p className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-semibold text-ink">{REASON_LABEL[l.reason] ?? l.reason}</span>
                          <span className={cn("font-bold tabular-nums", l.delta < 0 ? "text-sale" : "text-forest-fg")}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                        </p>
                        <p className="text-xs text-ink-muted">
                          {when(l.at)} · {l.actor === "admin" ? "Admin" : l.actor === "system" ? "Automatic" : l.actor} · stock after {l.stockAfter ?? "—"}
                        </p>
                        {l.orderId && (
                          <Link href={`/admin/orders/view?id=${l.orderId}`} className="text-xs font-semibold text-forest-fg hover:underline">
                            View order
                          </Link>
                        )}
                        {l.note && <p className="mt-0.5 text-sm text-ink-muted">{l.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SizeRow({
  r,
  threshold,
  busy,
  run,
  onHistory,
}: {
  r: InventoryRow;
  threshold: number;
  busy: boolean;
  run: (fn: () => Promise<unknown>, ok: string, after?: () => void) => void;
  onHistory: () => void;
}) {
  const low = r.stock !== null && r.stock > 0 && r.stock <= threshold;
  const out = r.stock !== null && r.stock <= 0;
  // Bar fills relative to 4× the alert level, so "healthy" stock reads as a full bar.
  const pct = r.stock === null ? 0 : Math.min(100, (Math.max(0, r.stock) / Math.max(threshold * 4, 1)) * 100);

  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(120px,1fr)_minmax(150px,1.2fr)_120px_auto] sm:px-5">
      <div className="min-w-0">
        <p className="font-semibold text-ink">
          {r.size}
          {!r.enabled && <span className="ml-2 rounded-full bg-ink/[0.07] px-2 py-0.5 text-[11px] font-medium text-ink-muted">Not on sale</span>}
        </p>
        <p className="truncate font-mono text-[11px] text-ink-muted">{r.sku ?? "No SKU"}</p>
      </div>

      <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
        {r.stock === null ? (
          <p className="text-sm text-ink-muted">Not tracked · always available</p>
        ) : (
          <div>
            <p className="flex items-baseline gap-2 text-sm">
              <span className={cn("text-lg font-bold tabular-nums", out ? "text-red-700" : low ? "text-sale" : "text-forest-text")}>{r.stock}</span>
              <span className={cn("text-xs font-semibold", out ? "text-red-700" : low ? "text-sale" : "text-ink-muted")}>{out ? "Out of stock" : low ? "Low stock" : "in stock"}</span>
            </p>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-khaki-soft">
              <span className={cn("block h-full rounded-full transition-[width]", out ? "bg-red-600" : low ? "bg-mustard" : "bg-forest-fg")} style={{ width: `${pct}%` }} />
            </span>
          </div>
        )}
      </div>

      <div className="order-4 flex gap-3 text-xs text-ink-muted sm:order-none">
        <span title="Held in unpaid checkouts" className={cn("inline-flex items-center gap-1", r.held > 0 && "font-semibold text-ink")}>
          <Clock className="size-3.5" /> {r.held}
        </span>
        <span title="Back-in-stock requests" className={cn("inline-flex items-center gap-1", r.waiting > 0 && "font-semibold text-sale")}>
          <Bell className="size-3.5" /> {r.waiting}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <AdjustPopover r={r} busy={busy} run={run} />
        <button type="button" onClick={onHistory} aria-label={`Stock history for ${r.productTitle} ${r.size}`} title="History" className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg">
          <History className="size-4" />
        </button>
      </div>
    </li>
  );
}

function AdjustPopover({ r, busy, run }: { r: InventoryRow; busy: boolean; run: (fn: () => Promise<unknown>, ok: string, after?: () => void) => void }) {
  const untracked = r.stock === null;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(untracked ? "set" : "add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<"restock_manual" | "damaged" | "correction">("restock_manual");
  const [note, setNote] = useState("");
  const n = Number(qty);
  const valid = qty !== "" && Number.isInteger(n) && n >= 0 && (mode === "set" || n > 0) && !(mode === "remove" && r.stock !== null && n > r.stock);
  const preview = mode === "set" ? n : mode === "add" ? (r.stock ?? 0) + n : (r.stock ?? 0) - n;

  const reset = () => (setQty(""), setNote(""), setMode(untracked ? "set" : "add"));

  const submit = () => {
    if (!valid) return;
    const effReason = mode === "set" ? "correction" : mode === "remove" ? (reason === "restock_manual" ? "damaged" : reason) : reason === "damaged" ? "restock_manual" : reason;
    run(
      async () => unwrap(await adjustStockAction({
          variantKey: r.variantKey,
          mode: mode === "set" ? "set" : "delta",
          value: mode === "set" ? n : mode === "add" ? n : -n,
          reason: effReason,
          ...(note.trim() ? { note: note.trim() } : {}),
        })),
      `${r.productTitle} ${r.size}: ${preview} in stock`,
      () => (setOpen(false), reset()),
    );
  };

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
          untracked ? "border border-dashed border-line text-ink-muted hover:border-forest/50 hover:text-forest-fg" : "bg-forest text-white hover:bg-forest-mid",
        )}
      >
        <SlidersHorizontal className="size-3.5" />
        {untracked ? "Track stock" : "Adjust"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl border-line bg-surface p-4">
        <p className="font-semibold text-forest-text">
          {r.productTitle.replace(/^(Wood|Cold)-Pressed /, "")} · {r.size}
        </p>
        <p className="text-xs text-ink-muted">{untracked ? "Enter how many you have to start tracking." : `${r.stock} in stock now`}</p>

        {!untracked && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-line bg-subtle p-1">
            {(
              [
                ["add", "Add"],
                ["remove", "Remove"],
                ["set", "Set count"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("h-8 rounded-lg text-xs font-semibold transition-colors", mode === m ? "bg-surface text-forest-text shadow-sm" : "text-ink-muted hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button type="button" aria-label="Decrease" onClick={() => setQty(String(Math.max(0, (Number(qty) || 0) - 1)))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink hover:border-forest/50">
            <Minus className="size-4" />
          </button>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="numeric"
            autoFocus
            placeholder="0"
            aria-label="Quantity"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface text-center text-lg font-bold tabular-nums text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          <button type="button" aria-label="Increase" onClick={() => setQty(String((Number(qty) || 0) + 1))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink hover:border-forest/50">
            <Plus className="size-4" />
          </button>
        </div>

        {mode !== "set" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(mode === "add"
              ? ([
                  ["restock_manual", "New stock arrived"],
                  ["correction", "Count correction"],
                ] as const)
              : ([
                  ["damaged", "Damaged / lost"],
                  ["correction", "Count correction"],
                ] as const)
            ).map(([k, label]) => {
              const on = reason === k || (mode === "add" && k === "restock_manual" && reason === "damaged") || (mode === "remove" && k === "damaged" && reason === "restock_manual");
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setReason(k)}
                  className={cn("h-7 rounded-full border px-3 text-xs font-medium transition-colors", on ? "border-forest bg-forest/10 text-forest-fg" : "border-line text-ink-muted hover:border-forest/40")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note (optional), e.g. batch no."
          className="mt-3 h-9 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {valid ? (
              <>
                New stock <strong className="text-base tabular-nums text-forest-text">{preview}</strong>
              </>
            ) : mode === "remove" && r.stock !== null && n > r.stock ? (
              <span className="text-red-700">Only {r.stock} in stock</span>
            ) : (
              "Enter a quantity"
            )}
          </p>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={submit}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-xs font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {untracked ? "Start tracking" : "Save"}
          </button>
        </div>

        {!untracked && (
          <div className="mt-3 border-t border-line pt-3">
            <ConfirmAction
              trigger={
                <button type="button" disabled={busy} className="text-xs font-medium text-ink-muted underline-offset-4 hover:text-red-700 hover:underline">
                  Stop tracking this size
                </button>
              }
              title={`Stop tracking ${r.size}?`}
              description="It will always show as available and orders won't reduce its stock. The change is logged."
              confirmLabel="Stop tracking"
              destructive
              onConfirm={() => run(async () => unwrap(await adjustStockAction({ variantKey: r.variantKey, mode: "untrack", value: 0, reason: "correction" })), `${r.size}: stopped tracking`, () => setOpen(false))}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ThresholdControl({ threshold, busy, onSave }: { threshold: number; busy: boolean; onSave: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(threshold));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-10 items-center gap-1.5 self-start rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink-muted transition-colors hover:border-forest/50 hover:text-forest-fg">
        <Settings2 className="size-3.5" /> Low stock alert: ≤ {threshold}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl border-line bg-surface p-4">
        <p className="font-semibold text-forest-text">Low stock alert</p>
        <p className="text-xs text-ink-muted">A size is flagged on the dashboard when its stock drops to this number or below.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={v}
            onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            aria-label="Low stock threshold"
            className="h-10 w-20 rounded-xl border border-line bg-surface text-center font-bold tabular-nums text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/15"
          />
          <button
            type="button"
            disabled={busy || v === ""}
            onClick={() => (onSave(Number(v)), setOpen(false))}
            className="h-10 flex-1 rounded-full bg-forest text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Thumb({ image, swatch }: { image: string | null; swatch: string | null }) {
  return (
    <span className="relative size-10 shrink-0">
      <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-subtle ring-1 ring-line">
        {image ? <Image src={image} alt="" width={40} height={40} className="size-10 object-cover" /> : <Boxes className="size-4 text-ink-muted" />}
      </span>
      {swatch && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface" style={{ background: swatch }} />}
    </span>
  );
}

function Stat({ icon: Icon, label, value, note, tone }: { icon: typeof Boxes; label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className={cn(card, "flex items-center gap-3 p-4", tone === "warn" && "border-warm-line")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "warn" ? "bg-warm-strong text-sale" : "bg-khaki-soft text-forest-fg")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate text-xl font-bold tracking-tight text-forest-text">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{note}</p>
      </div>
    </div>
  );
}
