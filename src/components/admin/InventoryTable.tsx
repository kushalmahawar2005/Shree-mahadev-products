"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { adjustStockAction, inventoryLogAction, setLowStockThresholdAction } from "@/lib/inventory-actions";
import type { InventoryRow } from "@/lib/server/inventory";
import { cn } from "@/lib/utils/cn";

type Filter = "all" | "low" | "out" | "untracked";
type LogEntry = Awaited<ReturnType<typeof inventoryLogAction>>[number];

const REASON_LABEL: Record<string, string> = {
  order: "Order",
  release: "Payment not completed",
  restock: "Order cancelled",
  rto_return: "RTO received back",
  restock_manual: "Restock",
  damaged: "Damaged",
  correction: "Correction",
};

export function InventoryTable({ rows, threshold }: { rows: InventoryRow[]; threshold: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Record<string, { value: string; reason: "restock_manual" | "damaged" | "correction" }>>({});
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [thr, setThr] = useState(String(threshold));

  const counts = {
    all: rows.length,
    low: rows.filter((r) => r.stock !== null && r.stock > 0 && r.stock <= threshold).length,
    out: rows.filter((r) => r.stock !== null && r.stock <= 0).length,
    untracked: rows.filter((r) => r.stock === null).length,
  };
  const shown = rows.filter((r) => {
    if (filter === "low" && !(r.stock !== null && r.stock > 0 && r.stock <= threshold)) return false;
    if (filter === "out" && !(r.stock !== null && r.stock <= 0)) return false;
    if (filter === "untracked" && r.stock !== null) return false;
    return !q || `${r.productTitle} ${r.size} ${r.sku ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      setMsg(null);
      try {
        await fn();
        setMsg({ ok: true, text: ok });
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message.replace(/^\[.*?\]\s*/, "") || "Could not save" });
      }
    });

  function apply(r: InventoryRow, sign: 1 | -1 | 0) {
    const d = draft[r.variantKey] ?? { value: "", reason: "restock_manual" as const };
    const n = Number(d.value);
    if (!Number.isInteger(n) || n < 0 || (sign !== 0 && n === 0)) return setMsg({ ok: false, text: "Enter a whole number" });
    const mode = sign === 0 ? "set" : "delta";
    const reason = sign === 0 ? "correction" : sign === -1 && d.reason === "restock_manual" ? "damaged" : d.reason;
    run(
      () => adjustStockAction({ variantKey: r.variantKey, mode, value: sign === 0 ? n : sign * n, reason }),
      `${r.productTitle} ${r.size}: stock updated`,
    );
    setDraft((x) => ({ ...x, [r.variantKey]: { ...d, value: "" } }));
  }

  async function toggleHistory(variantKey: string) {
    if (openLog === variantKey) return setOpenLog(null);
    try {
      setLog(await inventoryLogAction(variantKey));
      setOpenLog(variantKey);
    } catch (error) {
      setMsg({ ok: false, text: (error as Error).message || "Could not load stock history" });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "low", "out", "untracked"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold",
              f === filter ? "border-forest bg-forest text-white" : "border-line bg-white hover:border-forest/50",
            )}
          >
            {{ all: "All", low: "Low stock", out: "Out of stock", untracked: "Not tracked" }[f]}
            <span className="ml-1.5 opacity-70">{counts[f]}</span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product, size, SKU"
          className="ml-auto min-h-10 w-56 rounded-full border border-line px-4 text-sm"
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-muted">Low stock at or below</span>
        <input value={thr} onChange={(e) => setThr(e.target.value.replace(/\D/g, ""))} className="h-9 w-16 rounded-lg border border-line px-2 text-center" aria-label="Low stock threshold" />
        <button type="button" disabled={busy} onClick={() => run(() => setLowStockThresholdAction(Number(thr || 0)), "Threshold saved")} className="h-9 rounded-full border border-forest px-3 font-semibold text-forest">
          Save
        </button>
        {msg && <span role="status" className={cn("ml-2", msg.ok ? "text-forest" : "text-sale")}>{msg.text}</span>}
      </div>

      <div className="space-y-3 xl:hidden">
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-ink-muted">
            {rows.length ? "No sizes match this filter." : "No product sizes yet. Add a product to start tracking stock."}
          </p>
        ) : shown.map((r) => {
          const d = draft[r.variantKey] ?? { value: "", reason: "restock_manual" as const };
          const low = r.stock !== null && r.stock > 0 && r.stock <= threshold;
          return (
            <article key={r.variantKey} className="rounded-2xl border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/products/edit?handle=${r.handle}`} className="block truncate font-semibold text-forest-text hover:underline">{r.productTitle}</Link>
                  <p className="text-sm text-ink-muted">{r.size}{r.sku ? ` · ${r.sku}` : ""}</p>
                  <p className="text-xs text-ink-muted">{r.productStatus !== "active" ? `${r.productStatus} · ` : ""}{r.enabled ? "On sale" : "Not on sale"}</p>
                </div>
                {r.stock === null ? <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-ink-muted">Not tracked</span> : (
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-sm font-bold", r.stock <= 0 ? "bg-red-100 text-red-800" : low ? "bg-mustard/20 text-sale" : "bg-forest/10 text-forest")}>
                    {r.stock} in stock
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-4 border-y border-line py-2 text-xs text-ink-muted">
                <span>Held: <strong className="text-ink">{r.held || 0}</strong></span>
                <span>Back-in-stock requests: <strong className="text-ink">{r.waiting || 0}</strong></span>
                <button type="button" onClick={() => void toggleHistory(r.variantKey)} className="ml-auto font-semibold text-forest underline">
                  {openLog === r.variantKey ? "Hide history" : "History"}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="col-span-2 text-xs font-semibold text-ink-muted">
                  Quantity
                  <input
                    value={d.value}
                    onChange={(e) => setDraft((x) => ({ ...x, [r.variantKey]: { ...d, value: e.target.value.replace(/\D/g, "") } }))}
                    inputMode="numeric"
                    placeholder="Enter quantity"
                    aria-label={`Quantity for ${r.productTitle} ${r.size}`}
                    className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-sm text-ink"
                  />
                </label>
                <label className="col-span-2 text-xs font-semibold text-ink-muted">
                  Reason
                  <select
                    value={d.reason}
                    onChange={(e) => setDraft((x) => ({ ...x, [r.variantKey]: { ...d, reason: e.target.value as typeof d.reason } }))}
                    className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink"
                  >
                    <option value="restock_manual">Restock</option>
                    <option value="damaged">Damaged</option>
                    <option value="correction">Correction</option>
                  </select>
                </label>
                <button type="button" disabled={busy} onClick={() => apply(r, 1)} className="min-h-11 rounded-xl bg-forest px-3 text-sm font-semibold text-white disabled:opacity-50">Add stock</button>
                <button type="button" disabled={busy} onClick={() => apply(r, -1)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-50">Remove</button>
                <button type="button" disabled={busy} onClick={() => apply(r, 0)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-50">Set exact</button>
                {r.stock !== null && (
                  <button type="button" disabled={busy} onClick={() => {
                    if (window.confirm("Stop tracking stock for this size? It will always be available.")) {
                      run(() => adjustStockAction({ variantKey: r.variantKey, mode: "untrack", value: 0, reason: "correction" }), "Stopped tracking");
                    }
                  }} className="min-h-11 rounded-xl px-3 text-sm text-ink-muted underline disabled:opacity-50">Untrack</button>
                )}
              </div>
              {openLog === r.variantKey && (
                <div className="mt-3 rounded-xl bg-khaki-soft/30 p-3">
                  {log.length ? <ul className="space-y-1 text-xs">{log.map((entry, i) => (
                    <li key={i}>
                      <span className={cn("font-bold", entry.delta < 0 ? "text-sale" : "text-forest")}>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span> · {REASON_LABEL[entry.reason] ?? entry.reason} · after: {entry.stockAfter ?? "—"} · {entry.actor} · {entry.at.slice(0, 16)}{entry.note ? ` · ${entry.note}` : ""}
                    </li>
                  ))}</ul> : <p className="text-xs text-ink-muted">No stock changes yet.</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-white xl:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-khaki-soft/60 text-ink-muted">
            <tr>
              <th className="p-3 font-semibold">Product / size</th>
              <th className="p-3 font-semibold">SKU</th>
              <th className="p-3 font-semibold">In stock</th>
              <th className="p-3 font-semibold">Held</th>
              <th className="p-3 font-semibold">Waiting</th>
              <th className="p-3 font-semibold">Adjust</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-sm text-ink-muted">{rows.length ? "No sizes match this filter." : "No product sizes yet. Add a product to start tracking stock."}</td></tr>
            ) : shown.map((r) => {
              const d = draft[r.variantKey] ?? { value: "", reason: "restock_manual" as const };
              const low = r.stock !== null && r.stock > 0 && r.stock <= threshold;
              return (
                <Fragment key={r.variantKey}>
                  <tr className={cn(r.productStatus !== "active" && "opacity-60")}>
                    <td className="p-3">
                      <Link href={`/admin/products/edit?handle=${r.handle}`} className="font-semibold text-forest-text hover:underline">
                        {r.productTitle}
                      </Link>
                      <span className="block text-ink-muted">
                        {r.size}
                        {!r.enabled && " · not on sale"}
                        {r.productStatus !== "active" && ` · ${r.productStatus}`}
                      </span>
                    </td>
                    <td className="p-3 text-ink-muted">{r.sku ?? "—"}</td>
                    <td className="p-3">
                      {r.stock === null ? (
                        <span className="text-ink-muted">Not tracked</span>
                      ) : (
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", r.stock <= 0 ? "bg-red-100 text-red-800" : low ? "bg-mustard/20 text-sale" : "bg-forest/10 text-forest")}>
                          {r.stock}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{r.held || "—"}</td>
                    <td className="p-3">{r.waiting ? <span title="Customers asked to be notified">{r.waiting}</span> : "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          value={d.value}
                          onChange={(e) => setDraft((x) => ({ ...x, [r.variantKey]: { ...d, value: e.target.value.replace(/\D/g, "") } }))}
                          inputMode="numeric"
                          placeholder="Qty"
                          aria-label={`Quantity for ${r.productTitle} ${r.size}`}
                          className="h-9 w-16 rounded-lg border border-line px-2 text-center"
                        />
                        <select
                          value={d.reason}
                          onChange={(e) => setDraft((x) => ({ ...x, [r.variantKey]: { ...d, reason: e.target.value as typeof d.reason } }))}
                          className="h-9 rounded-lg border border-line px-2"
                          aria-label="Reason"
                        >
                          <option value="restock_manual">Restock</option>
                          <option value="damaged">Damaged</option>
                          <option value="correction">Correction</option>
                        </select>
                        <button type="button" disabled={busy} onClick={() => apply(r, 1)} className="h-9 w-9 rounded-lg bg-forest font-bold text-white" aria-label="Add">
                          +
                        </button>
                        <button type="button" disabled={busy} onClick={() => apply(r, -1)} className="h-9 w-9 rounded-lg border border-line font-bold" aria-label="Remove">
                          −
                        </button>
                        <button type="button" disabled={busy} onClick={() => apply(r, 0)} className="h-9 rounded-lg border border-line px-2 text-xs font-semibold" title="Set exact count (Correction)">
                          Set
                        </button>
                        {r.stock !== null ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm("Stop tracking stock for this size? It will always be available.")) {
                                run(() => adjustStockAction({ variantKey: r.variantKey, mode: "untrack", value: 0, reason: "correction" }), "Stopped tracking");
                              }
                            }}
                            className="h-9 px-1 text-xs text-ink-muted underline"
                          >
                            Untrack
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleHistory(r.variantKey)}
                        className="text-xs font-semibold text-forest underline"
                      >
                        {openLog === r.variantKey ? "Hide" : "History"}
                      </button>
                    </td>
                  </tr>
                  {openLog === r.variantKey && (
                    <tr>
                      <td colSpan={7} className="bg-khaki-soft/30 p-3">
                        {log.length ? (
                          <ul className="space-y-1 text-xs">
                            {log.map((l, i) => (
                              <li key={i}>
                                <span className={cn("font-bold", l.delta < 0 ? "text-sale" : "text-forest")}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span> ·{" "}
                                {REASON_LABEL[l.reason] ?? l.reason}
                                {l.orderId ? (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <Link href={`/admin/orders/view?id=${l.orderId}`} className="underline">
                                      order
                                    </Link>
                                  </>
                                ) : null}{" "}
                                · after: {l.stockAfter ?? "—"} · {l.actor} · {l.at.slice(0, 16)}
                                {l.note ? ` · ${l.note}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-ink-muted">No stock changes yet.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
