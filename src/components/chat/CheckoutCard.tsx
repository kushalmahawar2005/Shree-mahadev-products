"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, Check, ChevronDown, CreditCard, LoaderCircle, MapPin, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { AddressSheet } from "@/components/chat/AddressSheet";
import { ease, enter, rise, spring, staggerParent, tap } from "@/components/chat/motion";
import { useCart } from "@/components/cart/CartProvider";
import { chatCheckoutAction, placeChatOrderAction, type ChatCheckoutSummary, type ChatPlaceResult } from "@/lib/checkout-actions";

type Ready = Extract<ChatCheckoutSummary, { ok: true }>;
type Method = "cod" | "payu";
const PREFS_KEY = "smp_chat_checkout";
export const PAY_RESUME_KEY = "smp_chat_pay";
const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

function readPrefs(): { addressId?: number; method?: Method } {
  try { return JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as { addressId?: number; method?: Method }; } catch { return {}; }
}
function writePrefs(prefs: { addressId?: number | null; method?: Method }) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...prefs })); } catch { /* storage blocked */ }
}

/**
 * In-chat checkout: items, saved address, payment, server-computed totals and one confirm
 * button. Orders are only created by that button (idempotent per attempt); online payment
 * opens the existing PayU page and the chat resumes when the shopper comes back.
 */
export function CheckoutCard({ sheetRoot, onLogin, onPlaced }: {
  sheetRoot: HTMLElement | null;
  onLogin: () => void;
  onPlaced: (result: Extract<ChatPlaceResult, { ok: true }>) => void;
}) {
  const { refresh } = useCart();
  const [summary, setSummary] = useState<ChatCheckoutSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [addressId, setAddressId] = useState<number | null>(() => (typeof window === "undefined" ? null : readPrefs().addressId ?? null));
  const [method, setMethod] = useState<Method>(() => (typeof window === "undefined" ? "cod" : readPrefs().method ?? "cod"));
  const [showItems, setShowItems] = useState(false);
  const [pickAddress, setPickAddress] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [state, setState] = useState<"idle" | "placing" | "done">("idle");
  const [notice, setNotice] = useState<{ tone: "warning" | "error"; text: string } | null>(null);
  const attempt = useRef(newKey());
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let alive = true;
    chatCheckoutAction({ addressId })
      .then((next) => {
        if (!alive) return;
        setSummary(next);
        setFailed(false);
        if (next.ok) {
          if (next.addressId !== addressId) setAddressId(next.addressId);
          if (method === "cod" && next.quote && !next.quote.cod.allowed) setMethod("payu");
        }
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- method fallback only on (re)load
  }, [addressId, reloadTick]);

  useEffect(() => { writePrefs({ addressId, method }); }, [addressId, method]);

  async function confirm() {
    if (!summary?.ok || !summary.addressId || !summary.quote || state !== "idle") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setNotice({ tone: "error", text: "Internet nahi hai. Connection aane par dobara try karein." }); return; }
    const total = method === "cod" ? summary.quote.cod.total : summary.quote.payu.total;
    setNotice(null);
    setState("placing");
    let result: ChatPlaceResult;
    try {
      result = await placeChatOrderAction({ addressId: summary.addressId, method, idempotencyKey: attempt.current, expectedTotal: total });
    } catch {
      setState("idle");
      setNotice({ tone: "error", text: "Network issue. Dobara try karein." });
      return;
    }
    if (!result.ok) {
      setState("idle");
      if (result.auth === false) { onLogin(); return; }
      setNotice({ tone: result.changed ? "warning" : "error", text: result.error });
      if (result.changed) setReloadTick((tick) => tick + 1);
      return;
    }
    setState("done");
    if (result.method === "payu") {
      try { sessionStorage.setItem(PAY_RESUME_KEY, JSON.stringify({ orderId: result.orderId, orderNo: result.orderNo })); } catch { /* storage blocked */ }
      // Full load: the pay page auto-posts to PayU (a soft navigation would cancel that POST).
      window.location.assign(result.payUrl);
      return;
    }
    await refresh();
    onPlaced(result);
  }

  const box = "rounded-2xl border border-[#eadfca] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.04)]";
  if (failed) {
    return <div className={`${box} text-sm text-ink`}>Checkout load nahi ho paaya. <button type="button" onClick={() => { setFailed(false); setReloadTick((tick) => tick + 1); }} className="inline-flex items-center gap-1 font-semibold text-forest underline underline-offset-2"><RotateCcw size={13} />Dobara try karein</button></div>;
  }
  if (!summary) return <div className={`${box} space-y-2`}>{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-co-panel" />)}</div>;
  if (!summary.ok && !summary.auth) {
    return (
      <div className={`${box} space-y-2`}>
        <p className="text-sm text-ink">Order karne ke liye pehle login kar lijiye. Aapka cart yahin rahega.</p>
        <motion.button {...tap} type="button" onClick={onLogin} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[15px] font-semibold text-white"><ShieldCheck size={16} />Login karein</motion.button>
      </div>
    );
  }
  if (!summary.ok) return <div className={`${box} text-sm text-ink`}>{summary.empty ? "Cart abhi khaali hai. Pehle kuch add kijiye 🛒" : summary.error}</div>;

  const ready = summary as Ready;
  const address = ready.addresses.find((item) => item.id === ready.addressId);
  const quote = ready.quote;
  const total = quote ? (method === "cod" ? quote.cod.total : quote.payu.total) : ready.subtotal;
  const shipping = quote ? (method === "cod" ? quote.cod.shipping : quote.payu.shipping) : 0;

  return (
    <>
      <motion.div initial="hidden" animate="show" variants={staggerParent(0.06)} className={`${box} space-y-3`}>
        {/* a. Items */}
        <motion.div variants={rise}>
          <button type="button" onClick={() => setShowItems((value) => !value)} aria-expanded={showItems} className="flex min-h-11 w-full items-center justify-between text-left">
            <span className="text-[15px] font-semibold text-ink">{ready.itemCount} item{ready.itemCount === 1 ? "" : "s"} · <span className="tabular-nums">{rupee(ready.subtotal)}</span></span>
            <motion.span animate={{ rotate: showItems ? 180 : 0, transition: { duration: 0.2, ease: ease.outQuart } }}><ChevronDown size={18} className="text-ink-muted" /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showItems && (
              <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter() }} exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }} className="space-y-1 pb-1">
                {ready.items.map((item, index) => <li key={index} className="flex justify-between gap-2 text-[13px] text-ink-muted"><span className="truncate">{item.title} · {item.variant} × {item.qty}</span><span className="shrink-0 tabular-nums">{rupee(item.lineTotal)}</span></li>)}
              </motion.ul>
            )}
          </AnimatePresence>
        </motion.div>

        {/* b. Address */}
        <motion.div variants={rise} className="border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Delivery address</p>
          {address ? (
            <div className="flex items-start gap-2.5">
              <MapPin size={17} className="mt-0.5 shrink-0 text-forest" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-ink">{address.name} <span className="font-normal text-ink-muted">· {address.phoneMasked}</span></p>
                <p className="truncate text-ink-muted">{address.line1}, {address.city} {address.pincode}</p>
              </div>
              <button type="button" onClick={() => setPickAddress((value) => !value)} className="min-h-11 shrink-0 px-1 text-[13px] font-semibold text-forest underline-offset-2 hover:underline">Badlein</button>
            </div>
          ) : (
            <motion.button {...tap} type="button" onClick={() => setSheet(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-forest/40 text-sm font-semibold text-forest"><Plus size={16} />Delivery address jodein</motion.button>
          )}
          <AnimatePresence initial={false}>
            {pickAddress && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: enter() }} exit={{ opacity: 0, transition: { duration: 0.12, ease: ease.inQuart } }} className="mt-2 space-y-1.5">
                {ready.addresses.map((item) => (
                  <button key={item.id} type="button" onClick={() => { setAddressId(item.id); setPickAddress(false); }} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] ${item.id === ready.addressId ? "border-forest bg-co-brand-soft" : "border-line"}`}>
                    <span className="min-w-0"><span className="block font-semibold text-ink">{item.name}{item.isDefault ? " · Default" : ""}</span><span className="block truncate text-ink-muted">{item.line1}, {item.city} {item.pincode}</span></span>
                    {item.id === ready.addressId && <Check size={16} className="shrink-0 text-forest" />}
                  </button>
                ))}
                <button type="button" onClick={() => setSheet(true)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-forest"><Plus size={15} />Naya address</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* c. Payment */}
        {quote && (
          <motion.div variants={rise} className="border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Payment</p>
            {!quote.serviceable ? (
              <p className="rounded-xl bg-warm px-3 py-2 text-sm text-ink">Is pincode par abhi delivery nahi ho rahi. Doosra address chuniye.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
                {([["cod", "Cash on Delivery", Banknote], ["payu", "Online (UPI / Card)", CreditCard]] as const).map(([value, label, Icon]) => {
                  const disabled = value === "cod" && !quote.cod.allowed;
                  const active = method === value;
                  return (
                    <button key={value} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => setMethod(value)} title={disabled ? quote.cod.reason : undefined} className={`relative flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-forest text-forest" : "border-line text-ink"}`}>
                      {active && <motion.span layoutId="chat-pay-highlight" transition={spring.panel} className="absolute inset-0 rounded-xl bg-co-brand-soft" />}
                      <Icon size={17} className="relative shrink-0" /><span className="relative leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!quote.cod.allowed && quote.cod.reason && <p className="mt-1.5 text-[12.5px] text-ink-muted">{quote.cod.reason}</p>}
          </motion.div>
        )}

        {/* d. Price breakdown (server-computed) */}
        {quote && (
          <motion.dl variants={rise} className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-ink-muted"><dt>Subtotal</dt><dd className="tabular-nums">{rupee(ready.subtotal)}</dd></div>
            <div className="flex justify-between text-ink-muted"><dt>Shipping</dt><dd className="tabular-nums">{shipping ? rupee(shipping) : "Free"}</dd></div>
            {method === "cod" && quote.cod.codFee > 0 && <div className="flex justify-between text-ink-muted"><dt>COD charge</dt><dd className="tabular-nums">{rupee(quote.cod.codFee)}</dd></div>}
            <div className="flex justify-between pt-1 text-[15px] font-semibold text-ink"><dt>Total</dt><dd className="tabular-nums">{rupee(total)}</dd></div>
            {quote.edd && <p className="text-[12.5px] text-ink-muted">Delivery: {quote.edd}</p>}
          </motion.dl>
        )}

        <AnimatePresence>
          {notice && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: enter() }} exit={{ opacity: 0 }} role="alert" className={`rounded-xl px-3 py-2 text-[13px] ${notice.tone === "error" ? "bg-alert-soft text-alert" : "bg-warm text-ink"}`}>{notice.text}</motion.p>
          )}
        </AnimatePresence>

        {/* e. Confirm */}
        <motion.button
          variants={rise}
          whileTap={state === "idle" ? { scale: 0.97, transition: spring.press } : undefined}
          type="button"
          disabled={!address || !quote?.serviceable || state !== "idle"}
          onClick={() => void confirm()}
          className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-forest text-[15px] font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-60"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={state} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: ease.outQuart } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12, ease: ease.inQuart } }} className="flex items-center gap-2">
              {state === "placing" ? <><LoaderCircle size={17} className="animate-spin" />{method === "payu" ? "Payment page khul raha hai…" : "Order ho raha hai…"}</> : state === "done" ? <><Check size={18} />Ho gaya</> : <>Order confirm karein · <span className="tabular-nums">{rupee(total)}</span></>}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <p className="text-center text-[11px] text-ink-muted">Never type your card number, UPI PIN or OTP in chat. Online payment happens only on the secure payment page.</p>
      </motion.div>

      <AnimatePresence>
        {sheet && (
          <AddressSheet
            container={sheetRoot}
            onClose={() => setSheet(false)}
            onSaved={() => { setSheet(false); setPickAddress(false); setAddressId(null); setReloadTick((tick) => tick + 1); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
