"use client";

import { useState, useTransition } from "react";
import { saveStoreSettingsAction } from "@/lib/admin-actions";
import type { StoreSettings } from "@/lib/store-settings";
import { cn } from "@/lib/utils/cn";

const input = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-forest focus:outline-none";

function F({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}
function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
      <h2 className="text-lg font-semibold text-forest-text">{title}</h2>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const b = (k: keyof StoreSettings["business"], v: string) => setS((x) => ({ ...x, business: { ...x.business, [k]: v } }));
  const sh = <K extends keyof StoreSettings["shipping"]>(k: K, v: StoreSettings["shipping"][K]) => setS((x) => ({ ...x, shipping: { ...x.shipping, [k]: v } }));
  const num = (v: string) => Number(v.replace(/\D/g, "") || 0);
  const msgs = s.announcement.messages;
  const setMsgAt = (i: number, patch: Partial<(typeof msgs)[number]>) =>
    setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) } }));

  return (
    <div className="space-y-4">
      <Card title="Business" hint="Shown in the footer, emails, invoices and structured data.">
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

      <Card title="Invoice tax" hint="Confirm this with your accountant before issuing GST invoices. TODO(client): verify product tax rates and price treatment before go-live.">
        <F label="Catalog prices include GST">
          <span className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={s.pricesIncludeGst} onChange={(e) => setS((x) => ({ ...x, pricesIncludeGst: e.target.checked }))} className="size-5 accent-[var(--color-forest)]" /> Prices already include GST
          </span>
        </F>
      </Card>

      <Card title="Shipping & COD" hint="Courier rates come from NimbusPost. The flat fees are used only if rates can't be fetched.">
        <F label="Free shipping above (₹)" hint="Used in the announcement bar, cart progress bar and checkout."><input className={input} inputMode="numeric" value={s.shipping.freeShippingThreshold} onChange={(e) => sh("freeShippingThreshold", num(e.target.value))} /></F>
        <F label="Cash on delivery">
          <span className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={s.shipping.codEnabled} onChange={(e) => sh("codEnabled", e.target.checked)} className="size-5 accent-[var(--color-forest)]" /> Offer COD
          </span>
        </F>
        <F label="COD max order value (₹)" hint="0 = no limit"><input className={input} inputMode="numeric" value={s.shipping.codMaxOrder} onChange={(e) => sh("codMaxOrder", num(e.target.value))} /></F>
        <F label="Fallback shipping fee (₹)"><input className={input} inputMode="numeric" value={s.shipping.flatShippingFee} onChange={(e) => sh("flatShippingFee", num(e.target.value))} /></F>
        <F label="Fallback COD fee (₹)"><input className={input} inputMode="numeric" value={s.shipping.flatCodFee} onChange={(e) => sh("flatCodFee", num(e.target.value))} /></F>
        <F label="Low stock at or below" hint="Used on the Inventory page."><input className={input} inputMode="numeric" value={s.lowStockThreshold} onChange={(e) => setS((x) => ({ ...x, lowStockThreshold: num(e.target.value) }))} /></F>
      </Card>

      <Card title="Announcement bar" hint="Up to 3 messages. Use {threshold} to insert the free-shipping amount. Dates are optional (IST).">
        {msgs.map((m, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input className={input} value={m.text} onChange={(e) => setMsgAt(i, { text: e.target.value })} placeholder="Free shipping on orders above {threshold}" aria-label={`Message ${i + 1}`} />
            <input className={input} value={m.href} onChange={(e) => setMsgAt(i, { href: e.target.value })} placeholder="Link (optional)" aria-label="Link" />
            <input className={input} type="date" value={m.startsAt} onChange={(e) => setMsgAt(i, { startsAt: e.target.value })} aria-label="Starts" />
            <input className={input} type="date" value={m.endsAt} onChange={(e) => setMsgAt(i, { endsAt: e.target.value })} aria-label="Ends" />
            <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.filter((_, j) => j !== i) } }))} className="min-h-11 px-2 text-red-700">✕</button>
          </div>
        ))}
        <div className="flex items-center gap-3 sm:col-span-2">
          {msgs.length < 3 && (
            <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: [...x.announcement.messages, { text: "", href: "", startsAt: "", endsAt: "" }] } }))} className="min-h-10 rounded-full border border-forest px-4 text-sm font-semibold text-forest">
              + Add message
            </button>
          )}
          <label className="flex items-center gap-2 text-sm">
            Speed (sec/message)
            <input className={cn(input, "w-20")} inputMode="numeric" value={s.announcement.intervalSec} onChange={(e) => setS((x) => ({ ...x, announcement: { ...x.announcement, intervalSec: num(e.target.value) } }))} />
          </label>
        </div>
      </Card>

      <Card title="Social links">
        {s.socials.map((l, i) => (
          <div key={i} className="flex gap-2 sm:col-span-2">
            <input className={cn(input, "max-w-40")} value={l.label} placeholder="Instagram" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) }))} aria-label="Label" />
            <input className={input} value={l.href} placeholder="https://instagram.com/…" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, href: e.target.value } : y)) }))} aria-label="Link" />
            <button type="button" onClick={() => setS((x) => ({ ...x, socials: x.socials.filter((_, j) => j !== i) }))} className="px-2 text-red-700">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setS((x) => ({ ...x, socials: [...x.socials, { label: "", href: "" }] }))} className="min-h-10 justify-self-start rounded-full border border-forest px-4 text-sm font-semibold text-forest">
          + Add link
        </button>
      </Card>

      <div className="sticky bottom-0 z-10 flex items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveStoreSettingsAction(s);
              setMsg(r.ok ? { ok: true, text: "Saved. The whole site uses the new settings now." } : { ok: false, text: r.error });
            })
          }
          className="min-h-11 rounded-full bg-forest px-6 font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {msg && <p className={cn("text-sm", msg.ok ? "text-forest" : "text-sale")}>{msg.text}</p>}
      </div>
    </div>
  );
}
