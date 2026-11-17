"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  RotateCcw,
  Star,
  Truck,
} from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { whatsappLink } from "@/data/site";
import { cancelMyOrderAction, requestCancelOrderAction } from "@/lib/customer-account-actions";
import { cutoutUrl } from "@/lib/image-loader";
import type { AccountOrder } from "@/lib/server/account";
import { formatDateTime } from "@/lib/utils/format";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import {
  ConfirmDialog,
  OrderStatusBadge,
  OrderProgressMini,
  OrderTimeline,
} from "./shared";
import { arrivingBy, stepOf } from "@/lib/account/order-status";

export type ProductInfo = Record<string, { image?: string; titleHi?: string }>;

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Want to change items or address",
  "Found a better price",
  "Delivery is too slow",
  "Other",
] as const;
const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");
const CANCELLABLE = new Set([
  "pending_payment",
  "cod_pending",
  "confirmed",
  "packed",
  "paid",
]);

const btn =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors";
const primary = `${btn} bg-forest text-white hover:bg-forest-mid`;
const secondary = `${btn} border border-line bg-white text-ink hover:border-co-border-strong`;
const ghost = `${btn} text-ink-muted hover:bg-page hover:text-ink`;

/** One order: summary + the one action that matters for its status. `full` adds the delivery timeline. */
export function OrderCard({
  order: o,
  info,
  variant = "full",
  onChange,
}: {
  order: AccountOrder;
  info: ProductInfo;
  variant?: "full" | "compact";
  /** Called after an action changed the order (e.g. cancelled), for client-managed lists. */
  onChange?: () => void;
}) {
  const step = stepOf(o.status);
  const items = o.items.reduce((s, i) => s + i.qty, 0);
  const first = o.items[0];
  const eta =
    o.status === "shipped" || o.status === "out_for_delivery"
      ? arrivingBy(o.eta)
      : null;
  const times = Object.fromEntries(
    Object.entries(o.stepTimes).map(([k, v]) => [k, v ? formatDateTime(v) : v]),
  );
  return (
    <article className="rounded-3xl border border-line bg-white p-4 shadow-co-card sm:p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-ink">
              {o.orderNo}
            </span>
            <OrderStatusBadge status={o.status} />
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Placed {formatDateTime(o.createdAt)}
            {eta && (
              <span className="font-semibold text-co-success"> · {eta}</span>
            )}
          </p>
        </div>
        <Link
          href={`/account/orders/${o.id}`}
          className="-mr-2 inline-flex h-9 items-center gap-0.5 rounded-full px-2.5 text-sm font-semibold text-forest hover:bg-co-brand-soft"
        >
          Details <ChevronRight className="size-4" />
        </Link>
      </header>

      {variant === "full" && step >= 0 && (
        <>
          <div className="mt-4 rounded-2xl bg-page/60 px-3.5 py-3 md:hidden">
            <OrderProgressMini current={step} times={times} />
          </div>
          <div className="mt-5 hidden rounded-2xl bg-page/60 p-4 md:block">
            <OrderTimeline current={step} times={times} />
          </div>
        </>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="flex -space-x-3">
          {o.items.slice(0, 3).map((i) => (
            <span
              key={i.variantKey}
              className="grid size-12 place-items-center rounded-xl bg-white ring-2 ring-white"
            >
              <span className="grid size-12 place-items-center rounded-xl ring-1 ring-line">
                {info[i.handle]?.image ? (
                  <Image
                    src={cutoutUrl(info[i.handle]!.image!)}
                    alt=""
                    width={48}
                    height={48}
                    className="size-10 object-contain"
                  />
                ) : null}
              </span>
            </span>
          ))}
          {o.items.length > 3 && (
            <span className="grid size-12 place-items-center rounded-xl bg-page text-xs font-bold text-ink-muted ring-2 ring-white">
              +{o.items.length - 3}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {first ? shortTitle(first.title) : "Order"}
            {o.items.length > 1 && (
              <span className="font-normal text-ink-muted">
                {" "}
                + {o.items.length - 1} more
              </span>
            )}
          </p>
          <p className="text-xs text-ink-muted">
            {items} item{items === 1 ? "" : "s"} ·{" "}
            {o.method === "cod" ? "Cash on delivery" : ["pending_payment", "payment_failed", "cancelled"].includes(o.status) ? "Online payment · not paid" : "Paid online"}
          </p>
        </div>
        <p className="text-right text-base font-extrabold text-ink tabular-nums">
          {formatMoney(o.total)}
        </p>
      </div>

      <OrderActions order={o} onChange={onChange} />
    </article>
  );
}

function OrderActions({
  order: o,
  onChange,
}: {
  order: AccountOrder;
  onChange?: () => void;
}) {
  const router = useRouter();
  const { add, open } = useCart();
  const [buying, startBuy] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number]>(
    CANCEL_REASONS[0],
  );
  const help = whatsappLink(`Hi, I need help with order ${o.orderNo}.`);

  const buyAgain = () =>
    startBuy(async () => {
      for (const i of o.items) await add(i.variantKey, i.qty);
      open();
    });

  const cancel = async () => {
    const r = await cancelMyOrderAction({ orderId: o.id, reason });
    if (!r.ok) {
      // Paid online order: the team cancels + refunds, so offer to send the request right here.
      if ("canRequest" in r && r.canRequest) {
        toast.error(r.error, {
          duration: 10000,
          action: {
            label: "Cancel request bhejein",
            onClick: async () => {
              const q = await requestCancelOrderAction({ orderId: o.id, reason });
              if (!q.ok) return void toast.error(q.error);
              toast.success(`Request bhej di (${q.ticketNo}). Team jaldi cancel + refund karegi.`);
              onChange?.();
              router.refresh();
            },
          },
        });
        return;
      }
      toast.error(r.error);
      return;
    }
    toast.success(`Order ${o.orderNo} cancelled`);
    onChange?.();
    router.refresh();
  };

  const buyAgainBtn = (main?: boolean) => (
    <button
      type="button"
      onClick={buyAgain}
      disabled={buying}
      className={main ? primary : secondary}
    >
      {buying ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RotateCcw className="size-4" />
      )}{" "}
      Buy again
    </button>
  );
  const cancelBtn =
    CANCELLABLE.has(o.status) &&
    !(o.status === "paid" && o.method === "payu") ? (
      <button
        type="button"
        onClick={() => setCancelOpen(true)}
        className={ghost}
      >
        Cancel order
      </button>
    ) : null;

  let actions: React.ReactNode;
  switch (o.status) {
    case "pending_payment":
      actions = (
        <>
          {/* Plain <a>: the pay page must load fully so its PayU auto-post isn't cancelled by the router. */}
          <a href={`/checkout/pay?t=${o.token}`} className={primary}>
            <CreditCard className="size-4" />
            {/* Phones: short label so it fits beside "Cancel order". */}
            <span className="sm:hidden">Pay {formatMoney(o.total)}</span>
            <span className="max-sm:hidden">Complete payment {formatMoney(o.total)}</span>
          </a>
          {cancelBtn}
          {o.expiresInHours !== null && <span className="text-xs text-ink-muted max-sm:order-first max-sm:basis-full">Auto-cancels in {Math.max(0, o.expiresInHours)}h if unpaid</span>}
        </>
      );
      break;
    case "paid":
    case "cod_pending":
    case "confirmed":
    case "packed":
      actions = (
        <>
          <Link href={`/account/orders/${o.id}`} className={secondary}>
            View details
          </Link>
          {cancelBtn}
        </>
      );
      break;
    case "shipped":
    case "out_for_delivery":
      actions = (
        <>
          <Link href={`/account/orders/${o.id}#tracking`} className={primary}>
            <Truck className="size-4" /> Track order
          </Link>
          {o.trackingUrl && (
            <a
              href={o.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ghost}
            >
              Track on courier{o.awb ? ` · ${o.awb}` : ""}{" "}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </>
      );
      break;
    case "delivered":
      actions = (
        <>
          {buyAgainBtn(true)}
          <a href={`/order/invoice?t=${o.token}`} className={secondary}>
            <FileText className="size-4" /> Invoice
          </a>
          {!o.reviewed && (
            <Link href={`/review?t=${o.token}`} className={ghost}>
              <Star className="size-4" /> Rate
            </Link>
          )}
        </>
      );
      break;
    default:
      actions = (
        <>
          {buyAgainBtn(true)}
          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className={ghost}
          >
            <MessageCircle className="size-4" /> Need help?
          </a>
        </>
      );
  }

  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4 max-sm:[&>a]:flex-1 max-sm:[&>button]:flex-1",
      )}
    >
      {actions}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel order ${o.orderNo}?`}
        description="Items go back to stock. This can't be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        danger
        onConfirm={cancel}
      >
        <label className="block text-sm font-medium text-ink">
          Reason
          <select
            value={reason}
            onChange={(e) =>
              setReason(e.target.value as (typeof CANCEL_REASONS)[number])
            }
            className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus-visible:border-forest"
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </ConfirmDialog>
    </div>
  );
}
