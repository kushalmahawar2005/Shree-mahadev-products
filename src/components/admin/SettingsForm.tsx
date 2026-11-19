"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, CreditCard, Loader2, Megaphone, ReceiptText, Share2, Truck, X } from "lucide-react";
import { Switch } from "@/components/shadcn/switch";
import { saveStoreSettingsAction } from "@/lib/admin-actions";
import type { StoreSettings } from "@/lib/store-settings";
import { cn } from "@/lib/utils/cn";

const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const xBtn = "grid size-10 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-alert-soft hover:text-alert";

function F({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
function Card({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon: typeof Truck; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-bold text-forest-text">{title}</h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const GATEWAYS = [
  { id: "payu", label: "PayU" },
  { id: "cashfree", label: "Cashfree" },
] as const;

export function SettingsForm({ initial, gateways }: { initial: StoreSettings; gateways: Record<StoreSettings["paymentGateway"], boolean> }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const b = (k: keyof StoreSettings["business"], v: string) => setS((x) => ({ ...x, business: { ...x.business, [k]: v } }));
  const sh = <K extends keyof StoreSettings["shipping"]>(k: K, v: StoreSettings["shipping"][K]) => setS((x) => ({ ...x, shipping: { ...x.shipping, [k]: v } }));
  const num = (v: string) => Number(v.replace(/\D/g, "") || 0);
  const msgs = s.announcement.messages;
  const setMsgAt = (i: number, patch: Partial<(typeof msgs)[number]>) =>
    setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) } }));

  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const save = () =>
    start(async () => {
      const r = await saveStoreSettingsAction(s);
      if (r.ok) setSaved(s);
      setMsg(r.ok ? { ok: true, text: "Saved. The whole site uses the new settings now." } : { ok: false, text: r.error });
    });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save reads latest state on each render
  }, [dirty, s]);

  return (
    <div className="space-y-4">
      <Card icon={Building2} title="Business" hint="Shown in the footer, emails, invoices and structured data.">
        <F label="Legal name"><input className={input} value={s.business.legalName} onChange={(e) => b("legalName", e.target.value)} /></F>
        <F label="GSTIN" hint="15 characters. Leave empty until you have it."><input className={input} value={s.business.gstin} onChange={(e) => b("gstin", e.target.value.toUpperCase())} /></F>
        <F label="FSSAI licence no."><input className={input} value={s.business.fssai} onChange={(e) => b("fssai", e.target.value)} /></F>
        <F label="FSSAI expiry" hint="YYYY-MM-DD. The dashboard warns 30 days before."><input className={input} type="date" value={s.business.fssaiExpiry} onChange={(e) => b("fssaiExpiry", e.target.value)} /></F>
        <F label="Certification"><input className={input} value={s.business.iso} onChange={(e) => b("iso", e.target.value)} placeholder="ISO 9001:2015" /></F>
        <F label="Phone"><input className={input} value={s.business.phone} onChange={(e) => b("phone", e.target.value)} /></F>
        <F label="WhatsApp number" hint="91 + 10 digits"><input className={input} value={s.business.whatsapp} onChange={(e) => b("whatsapp", e.target.value.replace(/\D/g, ""))} /></F>
        <F label="Email"><input className={input} type="email" value={s.business.email} onChange={(e) => b("email", e.target.value)} /></F>
        <F label="Support hours"><input className={input} value={s.business.supportHours} onChange={(e) => b("supportHours", e.target.value)} /></F>
        <F label="Address line" className="sm:col-span-2"><input className={input} value={s.business.addressLine1} onChange={(e) => b("addressLine1", e.target.value)} /></F>
        <F label="City"><input className={input} value={s.business.city} onChange={(e) => b("city", e.target.value)} /></F>
        <F label="District"><input className={input} value={s.business.district} onChange={(e) => b("district", e.target.value)} /></F>
        <F label="State"><input className={input} value={s.business.state} onChange={(e) => b("state", e.target.value)} /></F>
        <F label="Pincode"><input className={input} inputMode="numeric" value={s.business.postalCode} onChange={(e) => b("postalCode", e.target.value)} /></F>
      </Card>

      <Card icon={ReceiptText} title="Invoice tax" hint="Confirm this with your accountant before issuing GST invoices. TODO(client): verify product tax rates and price treatment before go-live.">
        <F label="Catalog prices include GST">
          <span className="flex min-h-11 items-center gap-2">
            <Switch checked={s.pricesIncludeGst} onCheckedChange={(v) => setS((x) => ({ ...x, pricesIncludeGst: v }))} className="data-[state=checked]:bg-forest" /> Prices already include GST
          </span>
        </F>
      </Card>

      <Card icon={CreditCard} title="Online payments" hint="Which gateway new online payments go through. Refunds and checks always use the gateway that took that payment.">
        <div className="sm:col-span-2">
          <div role="radiogroup" aria-label="Payment gateway" className="inline-flex rounded-full border border-line bg-subtle p-1">
            {GATEWAYS.map((g) => {
              const on = s.paymentGateway === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!gateways[g.id] && !on}
                  onClick={() => setS((x) => ({ ...x, paymentGateway: g.id }))}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {g.label}
                  {!gateways[g.id] && <span className="text-[11px] font-normal">· keys missing</span>}
                </button>
              );
            })}
          </div>
          {!gateways[s.paymentGateway] && (
            <p className="mt-2 text-xs text-alert">{s.paymentGateway === "cashfree" ? "Cashfree" : "PayU"} keys are not set, so checkout uses the other gateway.</p>
          )}
        </div>
      </Card>

      <Card icon={Truck} title="Shipping & COD" hint="Courier rates come from NimbusPost. The flat fees are used only if rates can't be fetched.">
        <F label="Free shipping above (₹)" hint="Orders at or above this amount ship free. Updates everywhere at once: checkout charges, cart & drawer progress bar, announcement bar, product pages, FAQ, shipping policy and the chat assistant. 0 = always free."><input className={input} inputMode="numeric" value={s.shipping.freeShippingThreshold} onChange={(e) => sh("freeShippingThreshold", num(e.target.value))} /></F>
        <F label="Cash on delivery">
          <span className="flex min-h-11 items-center gap-2">
            <Switch checked={s.shipping.codEnabled} onCheckedChange={(v) => sh("codEnabled", v)} className="data-[state=checked]:bg-forest" /> Offer COD
          </span>
        </F>
        <F label="COD max order value (₹)" hint="0 = no limit"><input className={input} inputMode="numeric" value={s.shipping.codMaxOrder} onChange={(e) => sh("codMaxOrder", num(e.target.value))} /></F>
        <F label="Fallback shipping fee (₹)"><input className={input} inputMode="numeric" value={s.shipping.flatShippingFee} onChange={(e) => sh("flatShippingFee", num(e.target.value))} /></F>
        <F label="Fallback COD fee (₹)"><input className={input} inputMode="numeric" value={s.shipping.flatCodFee} onChange={(e) => sh("flatCodFee", num(e.target.value))} /></F>
        <F label="Low stock at or below" hint="Used on the Inventory page."><input className={input} inputMode="numeric" value={s.lowStockThreshold} onChange={(e) => setS((x) => ({ ...x, lowStockThreshold: num(e.target.value) }))} /></F>
      </Card>

      <Card icon={Megaphone} title="Announcement bar" hint="Up to 3 messages. Use {threshold} to insert the free-shipping amount. Dates are optional (IST).">
        {msgs.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input className={input} value={m.text} onChange={(e) => setMsgAt(i, { text: e.target.value })} placeholder="Free shipping on orders above {threshold}" aria-label={`Message ${i + 1}`} />
            <input className={input} value={m.href} onChange={(e) => setMsgAt(i, { href: e.target.value })} placeholder="Link (optional)" aria-label="Link" />
            <input className={input} type="date" value={m.startsAt} onChange={(e) => setMsgAt(i, { startsAt: e.target.value })} aria-label="Starts" />
            <input className={input} type="date" value={m.endsAt} onChange={(e) => setMsgAt(i, { endsAt: e.target.value })} aria-label="Ends" />
            <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.filter((_, j) => j !== i) } }))} className={xBtn} aria-label="Remove message"><X className="size-4" /></button>
          </div>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          {msgs.length < 3 && (
            <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: [...x.announcement.messages, { text: "", href: "", startsAt: "", endsAt: "" }] } }))} className="min-h-10 rounded-full border border-forest px-4 text-sm font-semibold text-forest-fg">
              + Add message
            </button>
          )}
          <label className="flex items-center gap-2 text-sm">
            Speed (sec/message)
            <input className={cn(input, "w-20")} inputMode="numeric" value={s.announcement.intervalSec} onChange={(e) => setS((x) => ({ ...x, announcement: { ...x.announcement, intervalSec: num(e.target.value) } }))} />
          </label>
        </div>
      </Card>

      <Card icon={Share2} title="Social links">
        {s.socials.map((l, i) => (
          <div key={i} className="flex gap-2 sm:col-span-2">
            <input className={cn(input, "max-w-40")} value={l.label} placeholder="Instagram" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) }))} aria-label="Label" />
            <input className={input} value={l.href} placeholder="https://instagram.com/…" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, href: e.target.value } : y)) }))} aria-label="Link" />
            <button type="button" onClick={() => setS((x) => ({ ...x, socials: x.socials.filter((_, j) => j !== i) }))} className={xBtn} aria-label="Remove link"><X className="size-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setS((x) => ({ ...x, socials: [...x.socials, { label: "", href: "" }] }))} className="min-h-10 justify-self-start rounded-full border border-forest px-4 text-sm font-semibold text-forest-fg">
          + Add link
        </button>
      </Card>

      <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <p className={cn("flex-1 text-sm", msg ? (msg.ok ? "text-forest-fg" : "text-alert") : "text-ink-muted")}>
          {msg && !dirty ? msg.text : dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        {dirty && (
          <button type="button" onClick={() => (setS(saved), setMsg(null))} className="h-10 rounded-full border border-line px-4 text-sm font-semibold text-ink-muted hover:bg-khaki-soft">
            Discard
          </button>
        )}
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={save}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save settings <kbd className="hidden rounded bg-white/15 px-1.5 text-[10px] sm:inline">⌘S</kbd>
        </button>
      </div>
    </div>
  );
}
