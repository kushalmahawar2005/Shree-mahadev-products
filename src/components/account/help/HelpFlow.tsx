"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, PhoneCall, Truck } from "lucide-react";
import { CancelOrderButton } from "@/components/account/OrderDetailClient";
import { OrderStatusBadge } from "@/components/account/shared";
import { supportConfig } from "@/config/support";
import { getHelpOrderAction, submitSupportTicketAction } from "@/lib/account/support-actions";
import { arrivingBy } from "@/lib/account/order-status";
import { primaryBtn, secondaryBtn } from "@/lib/account/ui-classes";
import { cutoutUrl } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, formatName } from "@/lib/utils/format";
import { formatMoney } from "@/lib/utils/money";
import {
  ISSUES,
  PHOTO_ISSUES,
  issuesFor,
  type HelpOrderDetail,
  type HelpOrderOption,
  type HelpTicket,
  type IssueKey,
} from "./help-lib";
import { MyRequests } from "./MyRequests";
import { OrderPicker } from "./OrderPicker";
import { PhotoPicker, type HelpPhoto } from "./PhotoPicker";

type Done = { ticket: HelpTicket; whatsappUrl: string; phone: string };

/** Get help with an order: 1 pick order → 2 pick issue (with in-place answers) → 3 details + send. */
export function HelpFlow({
  orders: initialOrders,
  hasMore: initialHasMore,
  preselect,
  images,
  tickets: initialTickets,
}: {
  orders: HelpOrderOption[];
  hasMore: boolean;
  preselect: string | null;
  images: Record<string, string>;
  tickets: HelpTicket[];
}) {
  const reduce = useReducedMotion();
  const [orders, setOrders] = useState(initialOrders);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [tickets, setTickets] = useState(initialTickets);
  // undefined = not chosen yet, null = "Not about a specific order"
  const [order, setOrder] = useState<HelpOrderOption | null | undefined>(() =>
    preselect ? initialOrders.find((o) => o.orderNo.replace(/^#/, "") === preselect.replace(/^#/, "")) : undefined,
  );
  const [detail, setDetail] = useState<HelpOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(Boolean(preselect));
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const [step3, setStep3] = useState(false);
  const [message, setMessage] = useState("");
  const [utr, setUtr] = useState("");
  const [photos, setPhotos] = useState<HelpPhoto[]>([]);
  const [pref, setPref] = useState<"whatsapp" | "call">("whatsapp");
  const [slot, setSlot] = useState<string>(supportConfig.callbackSlots[0]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [sending, startSend] = useTransition();
  const step2Ref = useRef<HTMLHeadingElement>(null);
  const step3Ref = useRef<HTMLHeadingElement>(null);

  // Load status/tracking/refunds for the chosen order (powers the smart shortcuts).
  useEffect(() => {
    if (!order) return;
    let alive = true;
    getHelpOrderAction({ orderId: order.id })
      .then((r) => alive && setDetail(r.ok ? r.order : null))
      .finally(() => alive && setLoadingDetail(false));
    return () => {
      alive = false;
    };
  }, [order]);

  const pickOrder = (o: HelpOrderOption | null) => {
    setOrder(o);
    setDetail(null);
    setLoadingDetail(Boolean(o));
    setIssue(null);
    setStep3(false);
    setError(null);
    requestAnimationFrame(() => step2Ref.current?.focus());
  };
  const pickIssue = (k: IssueKey) => {
    setIssue(k);
    setError(null);
    // Issues answered in place wait for "Still need help?"; the rest go straight to step 3.
    const inPlace: IssueKey[] = ["where_is_order", "cancel", "refund_status", "why_cancelled", "return_refund", "when_ship"];
    setStep3(!inPlace.includes(k));
    if (!inPlace.includes(k)) requestAnimationFrame(() => step3Ref.current?.focus());
  };
  const goStep3 = () => {
    setStep3(true);
    requestAnimationFrame(() => step3Ref.current?.focus());
  };

  const uploading = photos.some((p) => p.state === "uploading");
  const submit = () =>
    startSend(async () => {
      if (!issue || order === undefined) return;
      setError(null);
      const r = await submitSupportTicketAction({
        orderId: order?.id ?? null,
        issue,
        message,
        utr: issue === "money_deducted" && utr.trim() ? utr.trim() : undefined,
        contactPref: pref,
        callbackSlot: pref === "call" ? slot : undefined,
        photos: PHOTO_ISSUES.includes(issue)
          ? photos.filter((p) => p.state === "done" && p.url && p.publicId).map((p) => ({ url: p.url!, publicId: p.publicId! }))
          : [],
      });
      if (!r.ok) return setError(r.error);
      setDone(r as Done);
      setTickets((t) => [r.ticket as HelpTicket, ...t]);
      if (pref === "whatsapp") window.open(r.whatsappUrl, "_blank", "noopener,noreferrer");
    });

  const reset = () => {
    setDone(null);
    setOrder(undefined);
    setDetail(null);
    setIssue(null);
    setStep3(false);
    setMessage("");
    setUtr("");
    setPhotos([]);
  };

  const fade = reduce
    ? {}
    : { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 }, transition: { duration: 0.2 } };

  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-co-card md:p-6" aria-labelledby="gh-h">
      <h2 id="gh-h" className="text-lg font-bold text-ink">
        Get help with an order
      </h2>

      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div key="done" {...fade} className="mt-4 rounded-2xl bg-co-success/10 p-5 text-center">
              <CheckCircle2 className="mx-auto size-8 text-co-success" />
              <p className="mt-2 text-base font-bold text-ink">Request sent · {done.ticket.ticketNo}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {pref === "call"
                  ? `We'll call you on ${done.phone} between ${done.ticket.callbackSlot ?? slot}.`
                  : "WhatsApp opened with your ticket. Send the message there so we can reply."}
              </p>
              <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                {pref === "whatsapp" && (
                  <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(primaryBtn, "sm:w-auto sm:px-5")}>
                    <MessageCircle className="size-4" /> Open WhatsApp again
                  </a>
                )}
                <button type="button" onClick={reset} className={cn(secondaryBtn, "sm:w-auto sm:px-5")}>
                  Ask about something else
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="flow" {...fade} className="mt-4 space-y-5">
              {/* Step 1 */}
              <div>
                <StepLabel n={1} id="help-order-label">Which order?</StepLabel>
                <OrderPicker
                  orders={orders}
                  setOrders={setOrders}
                  hasMore={hasMore}
                  setHasMore={setHasMore}
                  value={order}
                  onChange={pickOrder}
                />
                {order && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-page/70 p-3">
                    <div className="flex -space-x-2">
                      {order.handles.slice(0, 3).map((h) => (
                        <span key={h} className="grid size-10 place-items-center rounded-xl bg-white ring-2 ring-white">
                          {images[h] && (
                            <Image src={cutoutUrl(images[h]!)} alt="" width={40} height={40} className="size-8 object-contain" />
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="min-w-0 flex-1 text-xs text-ink-muted">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {formatMoney(order.total)}
                      {arrivingBy(order.eta) && <span className="text-co-success"> · {arrivingBy(order.eta)}</span>}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                )}
              </div>

              {/* Step 2 */}
              {order !== undefined && (
                <div>
                  <StepLabel n={2} ref={step2Ref}>
                    What&apos;s wrong?
                  </StepLabel>
                  <div role="radiogroup" aria-label="Issue" className="flex flex-wrap gap-2">
                    {issuesFor(order?.status ?? null).map((k) => {
                      const on = issue === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => pickIssue(k)}
                          className={cn(
                            "relative h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                            on ? "border-forest text-white" : "border-line bg-white text-ink hover:border-co-border-strong",
                          )}
                        >
                          {on && (
                            <motion.span
                              layoutId="help-chip"
                              transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.35 }}
                              className="absolute inset-0 rounded-full bg-forest"
                            />
                          )}
                          <span className="relative">{ISSUES[k]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {issue && order && (
                    <Shortcut issue={issue} detail={detail} loading={loadingDetail} step3={step3} onMore={goStep3} />
                  )}
                </div>
              )}

              {/* Step 3 */}
              {issue && step3 && (
                <div className="space-y-4">
                  <StepLabel n={3} ref={step3Ref}>
                    Tell us more
                  </StepLabel>
                  {issue === "money_deducted" && (
                    <label className="block text-sm font-medium text-ink">
                      UPI ref / UTR <span className="font-normal text-ink-muted">(from your bank SMS or UPI app)</span>
                      <input
                        value={utr}
                        onChange={(e) => setUtr(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40))}
                        inputMode="text"
                        className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 font-mono text-base text-ink outline-none focus-visible:border-forest"
                        placeholder="e.g. 431298765432"
                      />
                    </label>
                  )}
                  <label className="block text-sm font-medium text-ink">
                    Describe the issue <span className="font-normal text-ink-muted">(optional)</span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, supportConfig.messageMax))}
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base font-normal text-ink outline-none focus-visible:border-forest"
                    />
                    <span className="mt-1 block text-right text-xs font-normal text-ink-muted tabular-nums">
                      {message.length}/{supportConfig.messageMax}
                    </span>
                  </label>
                  {PHOTO_ISSUES.includes(issue) && (
                    <div>
                      <PhotoPicker photos={photos} setPhotos={setPhotos} />
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Photos of the bottle/box and the label help us resolve it faster.
                      </p>
                    </div>
                  )}
                  <fieldset>
                    <legend className="text-sm font-medium text-ink">How should we reach you?</legend>
                    <div role="radiogroup" className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["whatsapp", "WhatsApp", MessageCircle],
                          ["call", "Call me back", PhoneCall],
                        ] as const
                      ).map(([k, label, Icon]) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={pref === k}
                          onClick={() => setPref(k)}
                          className={cn(
                            "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold",
                            pref === k ? "border-forest bg-co-brand-soft text-forest-text" : "border-line bg-white text-ink",
                          )}
                        >
                          <Icon className="size-4" /> {label}
                        </button>
                      ))}
                    </div>
                    {pref === "call" && (
                      <select
                        aria-label="Call-back time"
                        value={slot}
                        onChange={(e) => setSlot(e.target.value)}
                        className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
                      >
                        {supportConfig.callbackSlots.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </fieldset>
                  {error && (
                    <p role="alert" className="text-sm font-medium text-co-danger">
                      {error}
                    </p>
                  )}
                  <button type="button" onClick={submit} disabled={sending || uploading} className={primaryBtn}>
                    {(sending || uploading) && <Loader2 className="size-4 animate-spin" />}
                    {uploading ? "Uploading photos…" : "Send to support"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {tickets.length > 0 && <MyRequests tickets={tickets} />}
    </section>
  );
}

function StepLabel({
  n,
  id,
  children,
  ref,
}: {
  n: number;
  id?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <h3 id={id} ref={ref} tabIndex={-1} className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink outline-none">
      <span className="grid size-6 place-items-center rounded-full bg-co-brand-soft text-xs font-bold text-forest-text">{n}</span>
      {children}
    </h3>
  );
}

/** Answers the common questions right here; "Still need help?" moves on to step 3. */
function Shortcut({
  issue,
  detail: d,
  loading,
  step3,
  onMore,
}: {
  issue: IssueKey;
  detail: HelpOrderDetail | null;
  loading: boolean;
  step3: boolean;
  onMore: () => void;
}) {
  const box = "mt-3 rounded-2xl border border-line bg-page/60 p-4 text-sm text-ink";
  if (loading || !d)
    return issue === "change_address" || issue === "money_deducted" ? null : (
      <div className={cn(box, "flex items-center gap-2 text-ink-muted")}>
        <Loader2 className="size-4 animate-spin" /> Checking your order…
      </div>
    );
  const more = !step3 && (
    <button type="button" onClick={onMore} className="mt-3 text-sm font-semibold text-forest hover:underline">
      Still need help? →
    </button>
  );
  switch (issue) {
    case "where_is_order":
    case "when_ship": {
      const eta = arrivingBy(d.eta);
      return (
        <div className={box}>
          <p className="flex items-center gap-2 font-semibold">
            <Truck className="size-4 text-ink-muted" />
            {d.lastScan
              ? `${formatName(d.lastScan.status.replace(/[_-]+/g, " "))}${d.lastScan.location ? ` · ${formatName(d.lastScan.location)}` : ""}`
              : ["shipped", "out_for_delivery"].includes(d.status)
                ? "Shipped. Courier updates will appear soon."
                : "Not shipped yet. Usually ships within 1–2 days."}
          </p>
          {d.lastScan && <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(d.lastScan.at)}</p>}
          {eta && <p className="mt-1 font-semibold text-co-success">{eta}</p>}
          {d.trackingUrl && (
            <a href={d.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex h-9 items-center gap-1 font-semibold text-forest hover:underline">
              Track on courier{d.awb ? ` · ${d.awb}` : ""} <ExternalLink className="size-3.5" />
            </a>
          )}
          {more}
        </div>
      );
    }
    case "cancel":
      return (
        <div className={box}>
          {d.canCancel.ok ? (
            <>
              <p>You can cancel this order yourself. Items go back to stock.</p>
              <div className="mt-3 sm:w-56">
                <CancelOrderButton orderId={d.id} orderNo={d.orderNo} />
              </div>
            </>
          ) : (
            <p>{d.canCancel.reason}</p>
          )}
          {more}
        </div>
      );
    case "change_address":
      return (
        <p className={box}>
          We can update the address before the order is packed. Tell us the new address below, with the pincode.
        </p>
      );
    case "money_deducted":
      return (
        <p className={box}>
          If money left your account but the order shows unpaid, your bank reverses it automatically in{" "}
          {supportConfig.autoRefundDays}. Share the UPI ref / UTR below and we&apos;ll check it for you.
        </p>
      );
    case "refund_status":
      return (
        <div className={box}>
          {d.refunds.length ? (
            d.refunds.map((r, i) => (
              <p key={i}>
                <span className="font-semibold">{formatMoney(r.amount)}</span> ·{" "}
                {r.status === "success" ? "Refunded" : r.status === "failed" ? "Failed, our team is on it" : "Processing"} ·{" "}
                {formatDateTime(r.at, { time: false })}
                {r.ref && <span className="text-ink-muted"> · Ref {r.ref}</span>}
              </p>
            ))
          ) : (
            <p>No refund on this order{d.method === "cod" ? " (cash on delivery, nothing was paid)" : ""}.</p>
          )}
          {more}
        </div>
      );
    case "why_cancelled":
      return (
        <div className={box}>
          <p>{d.cancelReason ?? "This order wasn't cancelled."}</p>
          {more}
        </div>
      );
    case "return_refund":
      return (
        <div className={box}>
          <p>
            {d.returnRequested
              ? "A return is already requested for this order."
              : d.returnDaysLeft !== null && d.returnDaysLeft >= 0
                ? `You can request a return from the order page (${d.returnDaysLeft} day${d.returnDaysLeft === 1 ? "" : "s"} left).`
                : "The return window for this order has closed."}
          </p>
          <Link href={`/account/orders/${d.id}`} className="mt-2 inline-flex h-9 items-center font-semibold text-forest hover:underline">
            Open order →
          </Link>
          {more}
        </div>
      );
    default:
      return null;
  }
}
