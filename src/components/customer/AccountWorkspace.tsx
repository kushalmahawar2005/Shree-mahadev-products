"use client";

import { cutoutUrl } from "@/lib/image-loader";
import Link from "next/link";
import { safeInternalPath } from "@/lib/utils/safe-path";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronRight, Loader2, LogOut, Plus, RotateCcw } from "lucide-react";
import { BadgeCheck, BookOpen, Boxes, MapPin, MessageCircle, Package, Phone, ShieldCheck, Store, Truck, UserRound, type DuoIcon } from "@/components/icons/duo";
import { SmartImage } from "@/components/ui/SmartImage";
import { helpLink } from "@/data/site";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { logoutCustomerAction, reorderAction, requestCustomerOtpAction, saveCustomerAddressAction, setCustomerNameAction, verifyCustomerOtpAction } from "@/lib/customer-account-actions";
import { completeEmailSignupAction, requestEmailOtpAction, verifyEmailOtpAction } from "@/lib/customer-email-login-actions";
import { LoginMethodToggle, type LoginMethod } from "@/components/account/LoginMethodToggle";
import { INDIAN_STATES } from "@/lib/checkout";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const field =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
type OrderItem = { title: string; variant: string; qty: number; image: string | null; handle: string };
type Order = { id: number; orderNo: string; status: string; total: number; createdAt: string; token?: string; items?: OrderItem[] };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };

const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Confirmed", tone: "bg-forest/10 text-forest" },
  confirmed: { label: "Confirmed", tone: "bg-forest/10 text-forest" },
  cod_pending: { label: "Placed · COD", tone: "bg-forest/10 text-forest" },
  packed: { label: "Packed", tone: "bg-forest/10 text-forest" },
  shipped: { label: "On the way", tone: "bg-co-gold/40 text-forest-deep" },
  delivered: { label: "Delivered", tone: "bg-forest text-white" },
  pending_payment: { label: "Awaiting payment", tone: "bg-warm text-ink" },
  payment_failed: { label: "Payment failed", tone: "bg-alert-soft text-alert" },
  cancelled: { label: "Cancelled", tone: "bg-alert-soft text-alert" },
  rto: { label: "Returning", tone: "bg-warm text-ink" },
  refunded: { label: "Refunded", tone: "bg-subtle text-ink-muted" },
  partially_refunded: { label: "Partly refunded", tone: "bg-subtle text-ink-muted" },
};
const date = (s: string) => {
  const d = new Date(s.replace(" ", "T") + (s.includes("+") ? "" : "+05:30"));
  return Number.isNaN(d.getTime()) ? s : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
};

export function AccountWorkspace({ customer, orders = [], addresses = [] }: { customer?: { name: string; phone: string; email: string }; orders?: Order[]; addresses?: Address[] }) {
  if (!customer) return <SignIn />;
  return <Dashboard customer={customer} orders={orders} addresses={addresses} />;
}

/** Phone + OTP sign-in (shadcn input-otp). `next`: where to go after signing in. */
export function SignIn({ next }: { next?: string } = {}) {
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<LoginMethod>("whatsapp");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // first → otp → (email sign-up) phone → (new account) name
  const [step, setStep] = useState<"first" | "otp" | "phone" | "name">("first");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  // Local dev only: the mock OTP the server returned (no gateway yet).
  const [devCode, setDevCode] = useState("");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const send = () =>
    start(async () => {
      setError("");
      const r = method === "email" ? await requestEmailOtpAction({ email }) : await requestCustomerOtpAction({ phone });
      if (!r.ok) return setError(r.error ?? "Couldn't send the OTP.");
      if ("phone" in r && r.phone) setPhone(r.phone);
      const mockCode = "devCode" in r ? (r.devCode ?? "") : "";
      setDevCode(mockCode);
      setCode(mockCode);
      setStep("otp");
    });
  const verify = () =>
    start(async () => {
      setError("");
      const r = method === "email" ? await verifyEmailOtpAction({ email, code }) : await verifyCustomerOtpAction({ phone, code });
      if (!r.ok) return setError(r.error ?? "That code didn't work.");
      if ("needsPhone" in r && r.needsPhone) return (setPhone(""), setStep("phone"));
      if ("needsName" in r && r.needsName) return setStep("name");
      done();
    });
  const savePhone = () =>
    start(async () => {
      setError("");
      const r = await completeEmailSignupAction({ phone });
      if (!r.ok) return setError(r.error);
      if (r.needsName) return setStep("name");
      done();
    });
  // Full load so the header (account + cart) reflects the new session.
  // Re-check on the client too: `next` must stay on this site.
  const done = () => (next ? window.location.assign(safeInternalPath(next, "/account")) : window.location.reload());
  const saveName = () =>
    start(async () => {
      setError("");
      const r = await setCustomerNameAction({ name });
      if (!r.ok) return setError(r.error);
      done();
    });

  const title =
    step === "name" ? "Welcome! What's your name?" : step === "phone" ? "Add your mobile number" : step === "otp" ? "Enter the OTP" : "Sign in";
  const disabled =
    pending ||
    (step === "name"
      ? name.trim().length < 2
      : step === "phone"
        ? phone.length !== 10
        : step === "otp"
          ? code.length !== 6
          : method === "email"
            ? !emailOk
            : phone.length !== 10);

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] md:p-8">
      <span className="shrink-0 text-forest">
        <UserRound className="size-10" />
      </span>
      <h2 className="mt-4 text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {step === "name" ? (
          "You're verified. We'll use your name on orders and delivery updates."
        ) : step === "phone" ? (
          "Your email is verified. Add the mobile number for delivery and order updates."
        ) : step === "otp" ? (
          <>
            We sent a 6-digit code to <span className="font-semibold break-all text-ink">{method === "email" ? email : `+91 ${phone}`}</span>.{" "}
            <button type="button" onClick={() => (setStep("first"), setCode(""), setError(""))} className="font-semibold text-forest underline-offset-2 hover:underline">
              Change
            </button>
          </>
        ) : (
          "See your orders, reorder in one tap and save addresses. No password needed."
        )}
      </p>

      {step === "first" && (
        <LoginMethodToggle
          value={method}
          onChange={(m) => (setMethod(m), setError(""))}
          layoutId="login-method-page"
          className="mt-5"
        />
      )}

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "name") saveName();
          else if (step === "phone") savePhone();
          else if (step === "otp") verify();
          else send();
        }}
      >
        {step === "name" ? (
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} autoFocus placeholder="Your full name" autoComplete="name" className={field} />
        ) : step === "otp" ? (
          <>
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={() => undefined} containerClassName="justify-center" autoFocus>
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 rounded-xl border border-line text-lg first:rounded-xl last:rounded-xl data-[active=true]:border-forest data-[active=true]:ring-forest/15" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {devCode && (
              <p className="rounded-xl border border-dashed border-warm-line bg-warm px-3 py-2 text-center text-xs text-ink-muted">
                Test mode: nothing is sent. Your OTP is <span className="font-bold tracking-widest text-ink">{devCode}</span> (filled in for you).
              </p>
            )}
          </>
        ) : method === "email" && step === "first" ? (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={160}
            className={field}
          />
        ) : (
          <label className="relative block">
            <span className="sr-only">{step === "phone" ? "Mobile number" : "WhatsApp number"}</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] font-semibold text-ink-muted">+91</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
              autoFocus={step === "phone"}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder={step === "phone" ? "10-digit mobile number" : "10-digit WhatsApp number"}
              className={cn(field, "pl-14 tracking-wide")}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="btn-shine inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {step === "name" ? "Continue" : step === "phone" ? "Continue" : step === "otp" ? "Verify & sign in" : "Send OTP"}
        </button>
        {step === "first" && (
          <p className="text-center text-xs text-ink-muted">
            {method === "whatsapp" ? "The OTP comes on WhatsApp. No WhatsApp? Switch to Email." : "We'll email you a 6-digit code."}
          </p>
        )}
      </form>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
        <ShieldCheck className="size-3.5 text-forest" /> Guest checkout still works without an account.
      </p>
    </div>
  );
}

type Tab = "overview" | "orders" | "addresses";

/** Order progress for the tracker: index into STEPS, or -1 when the order is not moving (unpaid, cancelled…). */
const STEPS = ["Placed", "Packed", "Shipped", "Delivered"] as const;
const STEP: Record<string, number> = { paid: 0, confirmed: 0, cod_pending: 0, packed: 1, shipped: 2, delivered: 3 };
const ACTIVE = new Set(["pending_payment", "paid", "confirmed", "cod_pending", "packed", "shipped"]);
const CLOSED = new Set(["cancelled", "payment_failed", "rto", "refunded", "partially_refunded"]);
const statusOf = (s: string) => STATUS[s] ?? { label: s.replace(/_/g, " "), tone: "bg-subtle text-ink-muted" };

/**
 * Signed-in account: profile card + sidebar menu (desktop) or tabs (phone), with Overview (latest order
 * tracker, quick actions, default address), Orders (filterable cards with product photos) and Addresses.
 */
function Dashboard({ customer, orders, addresses }: { customer: { name: string; phone: string; email: string }; orders: Order[]; addresses: Address[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const spent = orders.filter((o) => !["cancelled", "payment_failed", "pending_payment"].includes(o.status)).reduce((s, o) => s + o.total, 0);
  const firstName = customer.name.trim().split(/\s+/)[0] || "there";

  const reorder = (id: number) => {
    setBusyId(id);
    start(async () => {
      try {
        await reorderAction(id);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the header cart refreshes
        window.location.assign("/checkout");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reorder.");
        setBusyId(null);
      }
    });
  };

  const tabs: { key: Tab; label: string; icon: DuoIcon; count?: number }[] = [
    { key: "overview", label: "Overview", icon: UserRound },
    { key: "orders", label: "My orders", icon: Package, count: orders.length },
    { key: "addresses", label: "Addresses", icon: MapPin, count: addresses.length },
  ];
  const card = { pending, busyId, onReorder: reorder };

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
      {/* ── Sidebar: profile + menu ── */}
      <aside className="space-y-4 lg:sticky lg:top-32">
        <section className="relative overflow-hidden rounded-3xl bg-forest p-5 text-white shadow-[0_24px_48px_-36px_rgba(7,47,27,0.7)]">
          <span aria-hidden className="absolute -top-16 -right-16 size-44 rounded-full bg-white/[0.05]" />
          <div className="relative flex items-center gap-3.5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-co-gold text-xl font-extrabold text-forest-deep ring-4 ring-white/10">
              {customer.name.trim()[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-hindi text-sm leading-snug text-co-gold" lang="hi">
                नमस्ते
              </p>
              <p className="truncate text-xl font-bold text-white">{customer.name || "Welcome"}</p>
              <p className="flex items-center gap-1.5 text-[13px] text-white/70">
                +91 {customer.phone}
                <BadgeCheck className="size-4 text-co-gold" aria-label="Verified number" />
              </p>
            </div>
            <form action={logoutCustomerAction} className="lg:hidden">
              <button aria-label="Log out" className="grid size-10 place-items-center rounded-full border border-white/20 text-white/80 hover:bg-white/10">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
          {customer.email && <p className="relative mt-3 truncate text-[13px] text-white/60">{customer.email}</p>}
          <dl className="relative mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.07] py-3 text-center">
            {[
              [String(orders.length), "Orders"],
              [formatMoney(spent), "Spent"],
              [String(addresses.length), "Addresses"],
            ].map(([v, l]) => (
              <div key={l} className="min-w-0 px-1">
                <dt className="sr-only">{l}</dt>
                <dd className="truncate text-lg font-extrabold tabular-nums">{v}</dd>
                <dd className="text-[11px] tracking-wide text-white/60 uppercase">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <nav aria-label="Account" className="hidden rounded-3xl border border-line bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:block">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition-colors",
                  on ? "text-forest-text" : "text-ink-muted hover:bg-subtle hover:text-forest-text",
                )}
              >
                {on && <motion.span layoutId="acct-side" className="absolute inset-0 rounded-2xl bg-khaki-soft" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <t.icon className="relative size-5 text-forest" />
                <span className="relative flex-1">{t.label}</span>
                {t.count ? <span className="relative rounded-full bg-white px-2 py-0.5 text-xs font-bold text-forest-text tabular-nums">{t.count}</span> : null}
              </button>
            );
          })}
          <div className="mx-3 my-2 h-px bg-line" />
          {HELP.map((h) => (
            <Link key={h.href} href={h.href} className="flex h-10 items-center gap-3 rounded-2xl px-3 text-sm text-ink-muted transition-colors hover:bg-subtle hover:text-forest-text">
              <h.icon className="size-[18px] text-forest" /> {h.label}
            </Link>
          ))}
          <div className="mx-3 my-2 h-px bg-line" />
          <form action={logoutCustomerAction}>
            <button className="flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold text-alert transition-colors hover:bg-alert-soft">
              <LogOut className="size-[18px]" /> Log out
            </button>
          </form>
        </nav>
      </aside>

      {/* ── Content ── */}
      <div className="min-w-0">
        <header className="mb-5 hidden lg:block">
          <p className="font-hindi text-lg text-sale" lang="hi">
            मेरा खाता
          </p>
          <h1 className="text-4xl">Namaste, {firstName}</h1>
          <p className="mt-1 text-ink-muted">Your orders, addresses and details, all in one place.</p>
        </header>
        <h1 className="sr-only lg:hidden">My account</h1>

        {/* Phone tabs */}
        <div role="tablist" aria-label="Account sections" className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-line bg-white p-1 lg:hidden">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cn("relative h-10 rounded-full text-[13px] font-semibold transition-colors", on ? "text-white" : "text-forest-text")}
              >
                {on && <motion.span layoutId="acct-tab" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative">
                  {t.key === "orders" ? "Orders" : t.label}
                  {t.count ? <span className={cn("ml-1 tabular-nums", on ? "text-co-gold" : "text-ink-muted")}>{t.count}</span> : null}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
            {error}
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {tab === "overview" && <Overview orders={orders} addresses={addresses} card={card} go={setTab} />}
            {tab === "orders" && <OrdersTab orders={orders} card={card} />}
            {tab === "addresses" && <AddressesTab addresses={addresses} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const HELP: { href: string; label: string; icon: DuoIcon }[] = [
  { href: "/track-order", label: "Track an order", icon: Truck },
  { href: "/faq", label: "Help & FAQs", icon: BookOpen },
  { href: "/contact", label: "Contact us", icon: Phone },
];

type CardActions = { pending: boolean; busyId: number | null; onReorder: (id: number) => void };

function Overview({ orders, addresses, card, go }: { orders: Order[]; addresses: Address[]; card: CardActions; go: (t: Tab) => void }) {
  const latest = orders[0];
  const quick: { href: string; title: string; text: string; icon: DuoIcon; external?: boolean }[] = [
    { href: "/track-order", title: "Track an order", text: "Live courier status", icon: Truck },
    { href: "/shop", title: "Shop again", text: "Oils, honey, jaggery", icon: Store },
    { href: "/bulk-orders", title: "Bulk orders", text: "Tins for shops & events", icon: Boxes },
    { href: helpLink(), title: "Help & support", text: "Raise a request, 9am–6pm", icon: MessageCircle },
  ];
  return (
    <div className="space-y-5">
      {latest ? (
        <section>
          <SectionHead title="Latest order" action={orders.length > 1 ? { label: "All orders", onClick: () => go("orders") } : undefined} />
          <OrderCard order={latest} featured {...card} />
        </section>
      ) : (
        <EmptyOrders />
      )}

      <section>
        <SectionHead title="Quick actions" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quick.map((q) => (
            <li key={q.title}>
              <Link
                href={q.href}
                {...(q.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-line bg-white p-4 transition-[border-color,box-shadow] hover:border-forest/30 hover:shadow-[0_14px_30px_-24px_rgba(7,47,27,0.5)]"
              >
                <q.icon className="size-8 text-forest" />
                <span>
                  <span className="flex items-center gap-1 text-sm font-bold text-forest-text">
                    {q.title} <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="block text-xs text-ink-muted">{q.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHead title="Default address" action={{ label: addresses.length ? "Manage" : "Add", onClick: () => go("addresses") }} />
        {addresses[0] ? (
          <AddressCard a={addresses[0]} isDefault />
        ) : (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-sm text-ink-muted">No saved address yet. Add one for one-tap checkout.</p>
        )}
      </section>
    </div>
  );
}

function OrdersTab({ orders, card }: { orders: Order[]; card: CardActions }) {
  const filters = [
    { key: "all", label: "All", test: () => true },
    { key: "active", label: "Active", test: (o: Order) => ACTIVE.has(o.status) },
    { key: "delivered", label: "Delivered", test: (o: Order) => o.status === "delivered" },
    { key: "closed", label: "Cancelled", test: (o: Order) => CLOSED.has(o.status) },
  ];
  const [f, setF] = useState("all");
  const shown = orders.filter(filters.find((x) => x.key === f)!.test);
  if (!orders.length) return <EmptyOrders />;
  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {filters.map((x) => {
          const n = orders.filter(x.test).length;
          const on = f === x.key;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setF(x.key)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                on ? "border-forest bg-forest text-white" : "border-line bg-white text-forest-text hover:border-forest/30",
              )}
            >
              {x.label}
              <span className={cn("tabular-nums", on ? "text-co-gold" : "text-ink-muted")}>{n}</span>
            </button>
          );
        })}
      </div>
      {shown.length ? (
        shown.map((o) => <OrderCard key={o.id} order={o} {...card} />)
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-ink-muted">No orders here.</p>
      )}
    </div>
  );
}

function OrderCard({ order: o, featured, pending, busyId, onReorder }: { order: Order; featured?: boolean } & CardActions) {
  const st = statusOf(o.status);
  const step = STEP[o.status] ?? -1;
  const items = o.items ?? [];
  const units = items.reduce((s, i) => s + i.qty, 0);
  const lead = items[0];
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-subtle/60 px-4 py-3 sm:px-5">
        <p className="font-mono text-sm font-bold text-forest-text">{o.orderNo}</p>
        <span className="text-xs text-ink-muted">· {date(o.createdAt)}</span>
        <span className={cn("ml-auto rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
      </header>

      {featured && step >= 0 && (
        <ol className="flex px-2 pt-4 sm:px-6" aria-label={`Progress: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
              {i > 0 && <span aria-hidden className={cn("absolute top-[9px] right-1/2 h-0.5 w-full", i <= step ? "bg-forest" : "bg-line")} />}
              <span className={cn("relative grid size-5 place-items-center rounded-full border-2", i <= step ? "border-forest bg-forest text-white" : "border-line bg-white")}>
                {i <= step && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn("text-[11px] font-semibold sm:text-xs", i <= step ? "text-forest-text" : "text-ink-muted")}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <div className="flex shrink-0 -space-x-3">
          {items.slice(0, 3).map((it, i) => (
            <span key={i} className="relative grid size-14 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-khaki-soft shadow-sm" style={{ zIndex: 3 - i }}>
              {it.image ? <SmartImage src={cutoutUrl(it.image)} alt="" width={56} height={56} className="size-full object-contain p-1" /> : <Package className="size-6 text-forest/60" />}
            </span>
          ))}
          {items.length > 3 && (
            <span className="relative z-0 grid size-14 place-items-center rounded-2xl border-2 border-white bg-khaki-soft text-xs font-bold text-forest-text">+{items.length - 3}</span>
          )}
          {!items.length && (
            <span className="grid size-14 place-items-center rounded-2xl bg-khaki-soft">
              <Package className="size-6 text-forest/60" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {lead ? (
            <>
              <p className="line-clamp-1 text-sm font-semibold text-ink">
                {lead.title} <span className="font-normal text-ink-muted">{lead.variant}</span>
                {lead.qty > 1 && <span className="font-normal text-ink-muted"> × {lead.qty}</span>}
              </p>
              <p className="text-xs text-ink-muted">{items.length > 1 ? `+ ${items.length - 1} more · ${units} items` : `${units} item${units === 1 ? "" : "s"}`}</p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Order {o.orderNo}</p>
          )}
        </div>
        <p className="shrink-0 text-base font-extrabold text-forest-text tabular-nums sm:text-lg">{formatMoney(o.total)}</p>
      </div>

      <footer className="flex gap-2 border-t border-line px-4 py-3 sm:justify-end sm:px-5">
        {o.token && (
          <Link
            href={`/order?t=${o.token}`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-semibold text-forest-text transition-colors hover:border-forest/40 sm:flex-none"
          >
            {o.status === "shipped" ? (
              <>
                <Truck className="size-4 text-forest" /> Track
              </>
            ) : o.status === "pending_payment" ? (
              <>Complete payment</>
            ) : (
              <>
                View details <ArrowRight className="size-3.5" />
              </>
            )}
          </Link>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => onReorder(o.id)}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-forest px-4 text-[13px] font-bold text-white transition-colors hover:bg-forest-mid disabled:opacity-60 sm:flex-none"
        >
          {busyId === o.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Buy again
        </button>
      </footer>
    </article>
  );
}

function AddressesTab({ addresses }: { addresses: Address[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {addresses.map((a, i) => (
        <li key={i}>
          <AddressCard a={a} isDefault={i === 0} />
        </li>
      ))}
      <li>
        <AddAddress variant="card" />
      </li>
    </ul>
  );
}

function AddressCard({ a, isDefault }: { a: Address; isDefault?: boolean }) {
  return (
    <div className="h-full rounded-2xl border border-line bg-white p-4 text-sm leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <div className="mb-1.5 flex items-center gap-2">
        <MapPin className="size-5 text-forest" />
        <p className="font-bold text-ink">{a.name}</p>
        {isDefault && <span className="ml-auto rounded-full bg-khaki-soft px-2 py-0.5 text-[11px] font-bold text-forest-text">Default</span>}
      </div>
      <p className="text-ink">
        {a.line1}, {a.city}
      </p>
      <p className="text-ink">
        {a.state} {a.pincode}
      </p>
      <p className="mt-1 text-ink-muted">+91 {a.phone}</p>
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="font-body text-base font-bold text-forest-text">{title}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-forest hover:underline">
          {action.label} <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="rounded-3xl border border-line bg-white px-5 py-10 text-center">
      <Package className="mx-auto size-12 text-forest" />
      <p className="mt-3 text-lg font-bold text-forest-text">No orders yet</p>
      <p className="mt-1 text-sm text-ink-muted">Your first bottle of slow-pressed oil is a tap away.</p>
      <Link href="/shop" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-sm font-bold text-white hover:bg-forest-mid">
        Start shopping <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function AddAddress({ variant = "button" }: { variant?: "button" | "card" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "card" ? (
          <button
            type="button"
            className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/50 p-4 text-sm font-semibold text-forest-text transition-colors hover:border-forest/40 hover:bg-white"
          >
            <span className="grid size-10 place-items-center rounded-full border border-line bg-white">
              <Plus className="size-5 text-forest" />
            </span>
            Add a new address
          </button>
        ) : (
          <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-forest-text hover:border-forest/40">
            <Plus className="size-3.5" /> Add address
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">New address</DialogTitle>
          <DialogDescription>Saved for faster checkout next time.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 grid gap-3 sm:grid-cols-2"
          action={(form) =>
            start(async () => {
              setError("");
              try {
                await saveCustomerAddressAction(Object.fromEntries(form.entries()));
                window.location.reload();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Couldn't save.");
              }
            })
          }
        >
          <input name="name" required placeholder="Full name" autoComplete="name" className={field} />
          <input name="phone" required inputMode="numeric" placeholder="Mobile number" autoComplete="tel" className={field} />
          <input name="line1" required placeholder="House no., street, area" autoComplete="street-address" className={cn(field, "sm:col-span-2")} />
          <input name="city" required placeholder="City" autoComplete="address-level2" className={field} />
          <input name="pincode" required inputMode="numeric" maxLength={6} placeholder="Pincode" autoComplete="postal-code" className={field} />
          <select name="state" required defaultValue="" className={cn(field, "sm:col-span-2")}>
            <option value="" disabled>
              Select state
            </option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {error && <p className="text-sm text-alert sm:col-span-2">{error}</p>}
          <button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-forest text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">
            {pending && <Loader2 className="size-4 animate-spin" />} Save address
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
