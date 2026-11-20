"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  CircleCheck,
  CreditCard,
  ExternalLink,
  Link2,
  Loader2,
  Megaphone,
  Plug,
  Plus,
  ReceiptText,
  RotateCcw,
  Share2,
  Truck,
  X,
} from "lucide-react";
import { FacebookLogo, Globe, InstagramLogo, LinkedinLogo, WhatsappLogo, XLogo, YoutubeLogo } from "@phosphor-icons/react";
import { Switch } from "@/components/shadcn/switch";
import { saveStoreSettingsAction } from "@/lib/admin-actions";
import type { StoreSettings } from "@/lib/store-settings";
import { cn } from "@/lib/utils/cn";

export type Integration = { name: string; ok: boolean; warning: boolean; state: string; keys: string; note: string };

const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition-shadow placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const xBtn = "grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-alert-soft hover:text-alert";
const ghostBtn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold text-forest-fg transition-colors hover:bg-khaki-soft";

type SectionId = "connections" | "payments" | "shipping" | "announcement" | "business" | "tax" | "social";
const SECTIONS: { id: SectionId; label: string; icon: typeof Truck }[] = [
  { id: "connections", label: "Connections", icon: Plug },
  { id: "payments", label: "Online payments", icon: CreditCard },
  { id: "shipping", label: "Shipping & COD", icon: Truck },
  { id: "announcement", label: "Announcement bar", icon: Megaphone },
  { id: "business", label: "Business details", icon: Building2 },
  { id: "tax", label: "Invoice tax", icon: ReceiptText },
  { id: "social", label: "Social links", icon: Share2 },
];

/** One setting: label + help on the left, the control on the right (stacks on phones). */
function Row({ label, hint, children, wide }: { label: string; hint?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("grid gap-2 py-4 first:pt-0 last:pb-0", wide ? "" : "md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8")}>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Section({ id, title, hint, icon: Icon, changed, action, children }: { id: SectionId; title: string; hint?: string; icon: typeof Truck; changed?: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} data-section={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-bold text-forest-text">
            {title}
            {changed && <span className="rounded-full bg-warm-strong px-2 py-0.5 text-[10px] font-semibold text-sale">Edited</span>}
          </h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
        {action}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** ₹-prefixed whole-rupee input. */
function Money({ value, onChange, label, suffix }: { value: number; onChange: (n: number) => void; label: string; suffix?: string }) {
  return (
    <span className="relative block max-w-xs">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">₹</span>
      <input aria-label={label} className={cn(input, "pl-7 tabular-nums", suffix && "pr-16")} inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0))} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">{suffix}</span>}
    </span>
  );
}

function Toggle({ checked, onChange, on, off }: { checked: boolean; onChange: (v: boolean) => void; on: string; off: string }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink">
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-forest" />
      {checked ? on : off}
    </label>
  );
}

const SOCIAL_ICONS: [RegExp, typeof Globe][] = [
  [/instagram/i, InstagramLogo],
  [/facebook|fb\.com/i, FacebookLogo],
  [/youtu/i, YoutubeLogo],
  [/whatsapp|wa\.me/i, WhatsappLogo],
  [/twitter|x\.com/i, XLogo],
  [/linkedin/i, LinkedinLogo],
];
const socialIcon = (href: string, label: string) => SOCIAL_ICONS.find(([re]) => re.test(href) || re.test(label))?.[1] ?? Globe;

const GATEWAYS = [
  { id: "payu", label: "PayU", blurb: "UPI, cards, netbanking, wallets" },
  { id: "cashfree", label: "Cashfree", blurb: "UPI, cards, netbanking, wallets, pay later" },
] as const;

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SettingsForm({
  initial,
  gateways,
  testModes = {},
  integrations = [],
}: {
  initial: StoreSettings;
  testModes?: Partial<Record<StoreSettings["paymentGateway"], boolean>>;
  gateways: Record<StoreSettings["paymentGateway"], boolean>;
  integrations?: Integration[];
}) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [active, setActive] = useState<SectionId>("connections");
  const rootRef = useRef<HTMLDivElement>(null);

  const b = (k: keyof StoreSettings["business"], v: string) => setS((x) => ({ ...x, business: { ...x.business, [k]: v } }));
  const sh = <K extends keyof StoreSettings["shipping"]>(k: K, v: StoreSettings["shipping"][K]) => setS((x) => ({ ...x, shipping: { ...x.shipping, [k]: v } }));
  const msgs = s.announcement.messages;
  const setMsgAt = (i: number, patch: Partial<(typeof msgs)[number]>) =>
    setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) } }));

  const dirty = !sameJson(s, saved);
  const changed = useMemo<Record<SectionId, boolean>>(
    () => ({
      connections: false,
      payments: s.paymentGateway !== saved.paymentGateway,
      shipping: !sameJson(s.shipping, saved.shipping) || s.lowStockThreshold !== saved.lowStockThreshold,
      announcement: !sameJson(s.announcement, saved.announcement),
      business: !sameJson(s.business, saved.business),
      tax: s.pricesIncludeGst !== saved.pricesIncludeGst,
      social: !sameJson(s.socials, saved.socials),
    }),
    [s, saved],
  );
  const changedCount = Object.values(changed).filter(Boolean).length;

  const save = () =>
    start(async () => {
      const r = await saveStoreSettingsAction(s);
      if (r.ok) setSaved(s);
      setMsg(r.ok ? { ok: true, text: "Saved. The whole site uses the new settings now." } : { ok: false, text: r.error });
    });

  // ⌘S saves; leaving with unsaved edits asks first.
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

  // Scroll-spy for the section nav.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>("[data-section]");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.getAttribute("data-section") as SectionId);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (id: SectionId) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const missing = integrations.filter((i) => !i.ok).length;
  const warnings = integrations.filter((i) => i.ok && i.warning).length;
  const threshold = s.shipping.freeShippingThreshold;
  const liveMsgs = msgs.filter((m) => m.text.trim()).map((m) => m.text.replaceAll("{threshold}", `₹${threshold.toLocaleString("en-IN")}`));

  return (
    <div ref={rootRef} className="grid gap-6 xl:grid-cols-[13rem_minmax(0,1fr)]">
      {/* Section nav: chips on small screens, sticky list on wide ones. */}
      <nav aria-label="Settings sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:sticky xl:top-20 xl:mx-0 xl:flex-col xl:self-start xl:overflow-visible xl:p-0">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => jump(id)}
            aria-current={active === id ? "true" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors xl:rounded-xl",
              active === id ? "bg-khaki-soft text-forest-fg" : "text-ink-muted hover:bg-subtle hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
            {changed[id] && <span className="size-1.5 rounded-full bg-sale" aria-label="edited" />}
            {id === "connections" && (missing || warnings) > 0 && <span className="ml-auto rounded-full bg-alert-soft px-1.5 text-[10px] font-bold text-alert">{missing + warnings}</span>}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-5 pb-24">
        {/* Connections: read-only status of the services the store relies on. */}
        {integrations.length > 0 && (
          <Section
            id="connections"
            title="Connections"
            hint="Payment, email and courier services. Keys live in the server environment and are never shown here."
            icon={Plug}
            action={
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", missing || warnings ? "bg-warm-strong text-sale" : "bg-forest/10 text-forest-fg")}>
                {missing ? `${missing} need setup` : warnings ? `${warnings} in test mode` : "All connected"}
              </span>
            }
          >
            <ul className="grid gap-2.5 pt-0 sm:grid-cols-2">
              {integrations.map((i) => {
                const bad = !i.ok || i.warning;
                return (
                  <li key={i.name} className="group rounded-xl border border-line bg-subtle p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-full", bad ? "bg-alert-soft text-alert" : "bg-forest/10 text-forest-fg")}>
                        {bad ? <AlertTriangle className="size-3.5" /> : <CircleCheck className="size-3.5" />}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{i.name}</p>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", bad ? "bg-alert-soft text-alert" : "bg-forest/10 text-forest-fg")}>{i.state}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-muted">{i.note}</p>
                    <code className="mt-2 block truncate text-[11px] text-ink-muted" title={i.keys}>{i.keys}</code>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section id="payments" title="Online payments" hint="Refunds and payment checks always use the gateway that took that payment." icon={CreditCard} changed={changed.payments}>
          <Row label="Gateway for new payments" hint="Shoppers paying online at checkout go through this one.">
            <div role="radiogroup" aria-label="Payment gateway" className="grid gap-2.5 sm:grid-cols-2">
              {GATEWAYS.map((g) => {
                const on = s.paymentGateway === g.id;
                const ready = gateways[g.id];
                const test = ready && testModes[g.id];
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!ready && !on}
                    onClick={() => setS((x) => ({ ...x, paymentGateway: g.id }))}
                    className={cn(
                      "relative rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                      on ? "border-forest-fg bg-forest/5 ring-2 ring-forest/15" : "border-line hover:border-forest-fg/40 hover:bg-subtle",
                    )}
                  >
                    <span className={cn("absolute right-3 top-3 grid size-5 place-items-center rounded-full border", on ? "border-forest bg-forest text-white" : "border-line")}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="block font-semibold text-ink">{g.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{g.blurb}</span>
                    <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", !ready ? "bg-subtle text-ink-muted" : test ? "bg-warm-strong text-sale" : "bg-forest/10 text-forest-fg")}>
                      {!ready ? "Keys missing" : test ? "Test mode" : "Live"}
                    </span>
                  </button>
                );
              })}
            </div>
            {gateways[s.paymentGateway] && testModes[s.paymentGateway] && (
              <p className="mt-3 flex gap-2 rounded-xl bg-warm px-3 py-2.5 text-xs text-ink">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-sale" />
                <span>
                  <b>{s.paymentGateway === "cashfree" ? "Cashfree" : "PayU"} is in test mode.</b> Payments move no real money, and such orders are flagged &ldquo;do not ship&rdquo;.
                </span>
              </p>
            )}
          </Row>
        </Section>

        <Section id="shipping" title="Shipping & COD" hint="Courier rates come live from the courier partners. The flat fees below are only a backup." icon={Truck} changed={changed.shipping}>
          <Row
            label="Free shipping above"
            hint="Updates checkout, the cart progress bar, announcement bar, product pages, FAQ, policy and the chat assistant together."
          >
            <Money label="Free shipping above" value={threshold} onChange={(n) => sh("freeShippingThreshold", n)} />
            <p className="mt-1.5 text-xs text-ink-muted">{threshold === 0 ? "Every order ships free." : `Orders of ₹${threshold.toLocaleString("en-IN")} or more ship free.`}</p>
          </Row>
          <Row label="Cash on delivery" hint="Let shoppers pay when the parcel arrives.">
            <Toggle checked={s.shipping.codEnabled} onChange={(v) => sh("codEnabled", v)} on="COD is offered" off="COD is off" />
            <AnimatePresence initial={false}>
              {s.shipping.codEnabled && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-ink-muted">Max COD order value</span>
                      <Money label="COD max order value" value={s.shipping.codMaxOrder} onChange={(n) => sh("codMaxOrder", n)} suffix={s.shipping.codMaxOrder ? undefined : "No limit"} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-ink-muted">Backup COD fee</span>
                      <Money label="Fallback COD fee" value={s.shipping.flatCodFee} onChange={(n) => sh("flatCodFee", n)} suffix={s.shipping.flatCodFee ? undefined : "Free"} />
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Row>
          <Row label="Backup shipping fee" hint="Charged only when courier rates can't be fetched.">
            <Money label="Fallback shipping fee" value={s.shipping.flatShippingFee} onChange={(n) => sh("flatShippingFee", n)} />
          </Row>
          <Row label="Low stock alert" hint="Products at or below this count show as low stock in Inventory.">
            <span className="relative block max-w-xs">
              <input aria-label="Low stock at or below" className={cn(input, "pr-14 tabular-nums")} inputMode="numeric" value={s.lowStockThreshold} onChange={(e) => setS((x) => ({ ...x, lowStockThreshold: Number(e.target.value.replace(/\D/g, "") || 0) }))} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">units</span>
            </span>
          </Row>
        </Section>

        <Section id="announcement" title="Announcement bar" hint="The thin strip at the very top of the store. Up to 3 messages." icon={Megaphone} changed={changed.announcement}>
          <Row label="Live preview" wide>
            <div className="overflow-hidden rounded-xl bg-forest text-white">
              {liveMsgs.length ? (
                <div className="flex items-center gap-6 overflow-x-auto px-4 py-2 text-xs font-medium [scrollbar-width:none]">
                  {liveMsgs.map((t, i) => (
                    <span key={i} className="flex shrink-0 items-center gap-6">
                      {i > 0 && <span className="text-mustard">✦</span>}
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-2 text-xs text-white/70">No messages: the bar is hidden.</p>
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Tip: type <code className="rounded bg-khaki-soft px-1">{"{threshold}"}</code> to insert the free-shipping amount.
            </p>
          </Row>
          <Row label="Messages" wide>
            <ul className="space-y-2.5">
              {msgs.map((m, i) => (
                <li key={i} className="rounded-xl border border-line bg-subtle p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-bold text-ink-muted">{i + 1}</span>
                    <input className={input} value={m.text} onChange={(e) => setMsgAt(i, { text: e.target.value })} placeholder="Free shipping on orders above {threshold}" aria-label={`Message ${i + 1}`} maxLength={120} />
                    <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: x.announcement.messages.filter((_, j) => j !== i) } }))} className={xBtn} aria-label={`Remove message ${i + 1}`}>
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-[1.4fr_1fr_1fr] sm:pr-11">
                    <span className="relative">
                      <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                      <input className={cn(input, "pl-8")} value={m.href} onChange={(e) => setMsgAt(i, { href: e.target.value })} placeholder="Link, e.g. /shop (optional)" aria-label={`Message ${i + 1} link`} />
                    </span>
                    <label className="relative">
                      <span className="pointer-events-none absolute -top-2 left-2.5 bg-subtle px-1 text-[10px] font-medium text-ink-muted">Starts</span>
                      <input className={input} type="date" value={m.startsAt} onChange={(e) => setMsgAt(i, { startsAt: e.target.value })} aria-label={`Message ${i + 1} start date`} />
                    </label>
                    <label className="relative">
                      <span className="pointer-events-none absolute -top-2 left-2.5 bg-subtle px-1 text-[10px] font-medium text-ink-muted">Ends</span>
                      <input className={input} type="date" value={m.endsAt} min={m.startsAt || undefined} onChange={(e) => setMsgAt(i, { endsAt: e.target.value })} aria-label={`Message ${i + 1} end date`} />
                    </label>
                  </div>
                  {(m.startsAt || m.endsAt) && (
                    <p className="mt-1.5 flex items-center gap-1 pl-8 text-[11px] text-ink-muted">
                      <CalendarClock className="size-3" /> Shows {m.startsAt ? `from ${m.startsAt}` : "now"}
                      {m.endsAt ? ` until ${m.endsAt}` : " with no end date"} (IST)
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {msgs.length < 3 && (
                <button type="button" onClick={() => setS((x) => ({ ...x, announcement: { ...x.announcement, messages: [...x.announcement.messages, { text: "", href: "", startsAt: "", endsAt: "" }] } }))} className={ghostBtn}>
                  <Plus className="size-4" /> Add message
                </button>
              )}
              <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
                Change every
                <input className={cn(input, "h-9 w-16 text-center tabular-nums")} inputMode="numeric" value={s.announcement.intervalSec} onChange={(e) => setS((x) => ({ ...x, announcement: { ...x.announcement, intervalSec: Number(e.target.value.replace(/\D/g, "") || 0) } }))} aria-label="Seconds per message" />
                sec
              </label>
            </div>
          </Row>
        </Section>

        <Section id="business" title="Business details" hint="Shown in the footer, emails, invoices and Google's store info." icon={Building2} changed={changed.business}>
          <Row label="Legal name & GSTIN" hint="GSTIN is 15 characters. Leave it empty until you have it.">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input className={input} value={s.business.legalName} onChange={(e) => b("legalName", e.target.value)} aria-label="Legal name" placeholder="Legal name" />
              <span className="relative">
                <input className={cn(input, "pr-14 font-mono uppercase")} value={s.business.gstin} maxLength={15} onChange={(e) => b("gstin", e.target.value.toUpperCase())} aria-label="GSTIN" placeholder="GSTIN" />
                {s.business.gstin && <span className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums", s.business.gstin.length === 15 ? "text-forest-fg" : "text-alert")}>{s.business.gstin.length}/15</span>}
              </span>
            </div>
          </Row>
          <Row label="Food licence & certification" hint="The dashboard warns 30 days before FSSAI expires.">
            <div className="grid gap-2.5 sm:grid-cols-3">
              <input className={input} value={s.business.fssai} onChange={(e) => b("fssai", e.target.value)} aria-label="FSSAI licence number" placeholder="FSSAI licence no." />
              <label className="relative">
                <span className="pointer-events-none absolute -top-2 left-2.5 bg-surface px-1 text-[10px] font-medium text-ink-muted">FSSAI expiry</span>
                <input className={input} type="date" value={s.business.fssaiExpiry} onChange={(e) => b("fssaiExpiry", e.target.value)} aria-label="FSSAI expiry" />
              </label>
              <input className={input} value={s.business.iso} onChange={(e) => b("iso", e.target.value)} placeholder="ISO 9001:2015" aria-label="Certification" />
            </div>
          </Row>
          <Row label="Contact" hint="WhatsApp is 91 + 10 digits.">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input className={input} value={s.business.phone} onChange={(e) => b("phone", e.target.value)} aria-label="Phone" placeholder="Phone" />
              <span className="relative">
                <WhatsappLogo className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input className={cn(input, "pl-9 tabular-nums")} inputMode="numeric" value={s.business.whatsapp} onChange={(e) => b("whatsapp", e.target.value.replace(/\D/g, ""))} aria-label="WhatsApp number" placeholder="WhatsApp" />
              </span>
              <input className={input} type="email" value={s.business.email} onChange={(e) => b("email", e.target.value)} aria-label="Email" placeholder="Email" />
              <input className={input} value={s.business.supportHours} onChange={(e) => b("supportHours", e.target.value)} aria-label="Support hours" placeholder="Support hours, e.g. 9am–6pm" />
            </div>
          </Row>
          <Row label="Address">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input className={cn(input, "sm:col-span-2")} value={s.business.addressLine1} onChange={(e) => b("addressLine1", e.target.value)} aria-label="Address line" placeholder="Address line" />
              <input className={input} value={s.business.city} onChange={(e) => b("city", e.target.value)} aria-label="City" placeholder="City" />
              <input className={input} value={s.business.district} onChange={(e) => b("district", e.target.value)} aria-label="District" placeholder="District" />
              <input className={input} value={s.business.state} onChange={(e) => b("state", e.target.value)} aria-label="State" placeholder="State" />
              <input className={cn(input, "tabular-nums")} inputMode="numeric" maxLength={6} value={s.business.postalCode} onChange={(e) => b("postalCode", e.target.value.replace(/\D/g, ""))} aria-label="Pincode" placeholder="Pincode" />
            </div>
          </Row>
        </Section>

        <Section id="tax" title="Invoice tax" hint="Confirm with your accountant before issuing GST invoices." icon={ReceiptText} changed={changed.tax}>
          <Row label="Catalog prices include GST" hint="On: GST is worked out inside the price. Off: GST is added on top at checkout.">
            <Toggle checked={s.pricesIncludeGst} onChange={(v) => setS((x) => ({ ...x, pricesIncludeGst: v }))} on="Prices already include GST" off="GST is added on top" />
          </Row>
        </Section>

        <Section id="social" title="Social links" hint="Shown in the footer and in Google's store info." icon={Share2} changed={changed.social}>
          <Row label="Profiles" wide>
            <ul className="space-y-2">
              {s.socials.map((l, i) => {
                const Icon = socialIcon(l.href, l.label);
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
                      <Icon className="size-5" weight="duotone" />
                    </span>
                    <input className={cn(input, "w-32 shrink-0 sm:w-40")} value={l.label} placeholder="Instagram" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) }))} aria-label={`Link ${i + 1} name`} />
                    <input className={input} value={l.href} placeholder="https://instagram.com/…" onChange={(e) => setS((x) => ({ ...x, socials: x.socials.map((y, j) => (j === i ? { ...y, href: e.target.value } : y)) }))} aria-label={`Link ${i + 1} URL`} />
                    {/^https?:\/\//.test(l.href) && (
                      <a href={l.href} target="_blank" rel="noreferrer" className="hidden size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft hover:text-forest-fg sm:grid" aria-label={`Open ${l.label || "link"}`}>
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                    <button type="button" onClick={() => setS((x) => ({ ...x, socials: x.socials.filter((_, j) => j !== i) }))} className={xBtn} aria-label={`Remove ${l.label || "link"}`}>
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setS((x) => ({ ...x, socials: [...x.socials, { label: "", href: "" }] }))} className={cn(ghostBtn, "mt-3")}>
              <Plus className="size-4" /> Add link
            </button>
          </Row>
        </Section>
      </div>

      {/* Save bar: floats in only when something changed (or right after a save). */}
      <AnimatePresence>
        {(dirty || msg) && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,.35)] backdrop-blur md:left-[calc(var(--sidebar-width,16rem)+1rem)]"
            role="status"
          >
            <span className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-sale" : msg?.ok ? "bg-forest-fg" : "bg-alert")} />
            <p className={cn("min-w-0 flex-1 truncate text-sm", !dirty && msg && !msg.ok ? "text-alert" : "text-ink")}>
              {dirty ? `Unsaved changes in ${changedCount} section${changedCount === 1 ? "" : "s"}` : msg?.text}
            </p>
            {dirty ? (
              <>
                <button type="button" onClick={() => (setS(saved), setMsg(null))} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-khaki-soft hover:text-ink">
                  <RotateCcw className="size-3.5" /> Discard
                </button>
                <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60">
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Save
                  <kbd className="hidden rounded bg-white/15 px-1.5 text-[10px] sm:inline">⌘S</kbd>
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMsg(null)} className={xBtn} aria-label="Dismiss">
                <X className="size-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
