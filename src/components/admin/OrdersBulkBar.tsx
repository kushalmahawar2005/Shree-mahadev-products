"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, CheckCircle2, FileText, Loader2, PackageCheck, Printer, Tag, Truck, X, XCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/shadcn/dialog";
import { bulkBookShipmentsAction, bulkCancelShipmentsAction, bulkStatusAction } from "@/lib/admin-actions";
import { unwrap } from "@/lib/action-result";
import type { BulkResult } from "@/lib/server/bulk-orders";
import { cn } from "@/lib/utils/cn";

const SELECTOR = "input.order-select";
const MAX = 50;

type Picked = { id: number; status: string; invoice: boolean };
/** Ticked orders (desktop table + phone list render the same order twice; dedupe by id). */
const readSelected = (): Picked[] => {
  const map = new Map<number, Picked>();
  document.querySelectorAll<HTMLInputElement>(`${SELECTOR}:checked`).forEach((b) =>
    map.set(Number(b.value), { id: Number(b.value), status: b.dataset.status ?? "", invoice: b.dataset.invoice === "1" }),
  );
  return [...map.values()];
};
// Which orders each action applies to (the bar only shows actions that fit the selection).
const TO_SHIP = new Set(["paid", "cod_pending", "confirmed"]);
const BOOKED = new Set(["packed"]);
const HAS_LABEL = new Set(["packed", "shipped"]);

/** Header checkbox: tick / untick every order on this page. */
export function SelectAllOrders() {
  const [all, setAll] = useState(false);
  useEffect(() => {
    const sync = () => {
      const boxes = [...document.querySelectorAll<HTMLInputElement>(SELECTOR)];
      setAll(boxes.length > 0 && boxes.every((b) => b.checked));
    };
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);
  return (
    <input
      type="checkbox"
      aria-label="Select all orders on this page"
      checked={all}
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((b) => (b.checked = e.target.checked));
        document.dispatchEvent(new Event("change"));
      }}
      className="size-5 accent-[var(--color-forest)]"
    />
  );
}

type Kind = "ship" | "cancel" | "confirmed" | "delivered";
type Confirm = { kind: Kind; ids: number[] } | null;

/**
 * Floating bar for many orders at once (like big stores): book shipments with the cheapest courier,
 * print all labels as one PDF, print invoices, confirm COD, mark delivered. Results per order.
 */
export function OrdersBulkBar() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const ids = picked.map((p) => p.id);
  const idsWhere = (test: (p: Picked) => boolean) => picked.filter(test).map((p) => p.id);
  const shipIds = idsWhere((p) => TO_SHIP.has(p.status));
  const cancelIds = idsWhere((p) => BOOKED.has(p.status));
  const labelIds = idsWhere((p) => HAS_LABEL.has(p.status));
  const invoiceIds = idsWhere((p) => p.invoice);
  const codIds = idsWhere((p) => p.status === "cod_pending");
  const deliverIds = idsWhere((p) => p.status === "shipped");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [results, setResults] = useState<{ title: string; rows: BulkResult[] } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const sync = () => setPicked(readSelected());
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);

  const clear = () => {
    document.querySelectorAll<HTMLInputElement>(SELECTOR).forEach((b) => (b.checked = false));
    setPicked([]);
    document.dispatchEvent(new Event("change"));
  };
  const tooMany = ids.length > MAX;
  const openPdf = (path: string, list: number[]) => {
    setError("");
    window.open(`${path}?ids=${list.slice(0, MAX).join(",")}`, "_blank", "noopener");
  };

  const run = (c: NonNullable<Confirm>) =>
    start(async () => {
      setError("");
      try {
        const rows =
          c.kind === "ship"
            ? unwrap(await bulkBookShipmentsAction(c.ids))
            : c.kind === "cancel"
              ? unwrap(await bulkCancelShipmentsAction(c.ids))
              : unwrap(await bulkStatusAction(c.ids, c.kind));
        const titles: Record<Kind, string> = { ship: "Shipments booked", cancel: "Shipments cancelled", confirmed: "COD orders confirmed", delivered: "Marked delivered" };
        setResults({ title: titles[c.kind], rows });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });

  const btn = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors disabled:opacity-50";
  return (
    <>
      <AnimatePresence>
        {ids.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-5xl rounded-2xl border border-line bg-surface p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]"
            role="toolbar"
            aria-label="Bulk order actions"
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-full bg-forest px-3 py-1.5 text-sm font-bold text-white tabular-nums">{ids.length} selected</span>
              <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
                {shipIds.length > 0 && (
                  <button type="button" disabled={pending || tooMany} onClick={() => setConfirm({ kind: "ship", ids: shipIds })} className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}>
                    <Truck className="size-4" /> Book shipments{shipIds.length !== ids.length ? ` (${shipIds.length})` : ""}
                  </button>
                )}
                {labelIds.length > 0 && (
                  <button type="button" disabled={pending} onClick={() => openPdf("/admin/orders/labels", labelIds)} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
                    <Tag className="size-4" /> Print labels{labelIds.length !== ids.length ? ` (${labelIds.length})` : ""}
                  </button>
                )}
                {invoiceIds.length > 0 && (
                  <button type="button" disabled={pending} onClick={() => openPdf("/admin/orders/invoice", invoiceIds)} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
                    <FileText className="size-4" /> Invoices{invoiceIds.length !== ids.length ? ` (${invoiceIds.length})` : ""}
                  </button>
                )}
                {codIds.length > 0 && (
                  <button type="button" disabled={pending || tooMany} onClick={() => setConfirm({ kind: "confirmed", ids: codIds })} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
                    <PackageCheck className="size-4" /> Confirm COD{codIds.length !== ids.length ? ` (${codIds.length})` : ""}
                  </button>
                )}
                {deliverIds.length > 0 && (
                  <button type="button" disabled={pending || tooMany} onClick={() => setConfirm({ kind: "delivered", ids: deliverIds })} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
                    <CheckCircle2 className="size-4" /> Mark delivered{deliverIds.length !== ids.length ? ` (${deliverIds.length})` : ""}
                  </button>
                )}
                {cancelIds.length > 0 && (
                  <button type="button" disabled={pending || tooMany} onClick={() => setConfirm({ kind: "cancel", ids: cancelIds })} className={cn(btn, "border border-sale/40 text-sale hover:bg-sale/10")}>
                    <Ban className="size-4" /> Cancel shipments{cancelIds.length !== ids.length ? ` (${cancelIds.length})` : ""}
                  </button>
                )}
                {!shipIds.length && !labelIds.length && !invoiceIds.length && !codIds.length && !deliverIds.length && !cancelIds.length && (
                  <span className="self-center px-2 text-sm text-ink-muted">No bulk action fits these orders.</span>
                )}
              </div>
              {pending && <Loader2 className="size-5 shrink-0 animate-spin text-forest-fg" />}
              <button type="button" onClick={clear} aria-label="Clear selection" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft">
                <X className="size-4" />
              </button>
            </div>
            {(error || tooMany) && <p role="alert" className="px-2 pt-1.5 text-xs text-sale">{tooMany ? `Select up to ${MAX} orders at a time.` : error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "ship"
                ? `Book ${confirm.ids.length} shipments?`
                : confirm?.kind === "cancel"
                  ? `Cancel ${confirm.ids.length} shipments?`
                  : confirm?.kind === "confirmed"
                    ? `Confirm ${confirm?.ids.length} COD orders?`
                    : `Mark ${confirm?.ids.length} orders delivered?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "cancel"
                ? "The courier booking is cancelled on NimbusPost (the charge comes back to your wallet) and the order goes back to To ship. Shipments the courier has already picked up can't be cancelled and are skipped."
                : confirm?.kind === "ship"
                ? "Each order is booked on NimbusPost with its cheapest courier, using the packed weight from the catalog. Your NimbusPost wallet is charged and customers get the shipped email. Orders that can't ship (unpaid, already booked) are skipped."
                : confirm?.kind === "confirmed"
                  ? "Only orders waiting for COD confirmation change. Others are skipped."
                  : "Only shipped orders change to delivered. Others are skipped."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) run(confirm);
                setConfirm(null);
              }}
              className="bg-forest text-white hover:bg-forest-mid"
            >
              {confirm?.kind === "ship" ? "Book shipments" : confirm?.kind === "cancel" ? "Cancel shipments" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!results}
        onOpenChange={(o) => {
          if (!o) {
            setResults(null);
            clear();
            router.refresh();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>{results?.title}</DialogTitle>
          <DialogDescription>
            {results ? `${results.rows.filter((r) => r.ok).length} done · ${results.rows.filter((r) => !r.ok).length} skipped or failed` : ""}
          </DialogDescription>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {results?.rows.map((r) => (
              <li key={r.id} className="flex items-start gap-2.5 px-3 py-2.5 text-sm">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-co-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-sale" />}
                <span className="min-w-0">
                  <b className="font-semibold text-ink">{r.orderNo}</b>
                  <span className="block text-ink-muted">{r.message}</span>
                </span>
              </li>
            ))}
          </ul>
          {results?.title === "Shipments booked" && results.rows.some((r) => r.ok) && (
            <button
              type="button"
              onClick={() => window.open(`/admin/orders/labels?ids=${results.rows.filter((r) => r.ok).map((r) => r.id).join(",")}`, "_blank", "noopener")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest text-sm font-semibold text-white hover:bg-forest-mid"
            >
              <Printer className="size-4" /> Print these labels
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
