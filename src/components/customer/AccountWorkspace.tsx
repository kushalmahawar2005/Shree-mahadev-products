"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Loader2, LogOut, MapPin, Package, Phone, Plus, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn/input-otp";
import { logoutCustomerAction, reorderAction, requestCustomerOtpAction, saveCustomerAddressAction, verifyCustomerOtpAction } from "@/lib/customer-account-actions";
import { INDIAN_STATES } from "@/lib/checkout";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const field =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[15px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/60 focus:border-forest focus:ring-4 focus:ring-forest/10";
type Order = { id: number; orderNo: string; status: string; total: number; createdAt: string; token?: string };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };

const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Confirmed", tone: "bg-forest/10 text-forest" },
  confirmed: { label: "Confirmed", tone: "bg-forest/10 text-forest" },
  cod_pending: { label: "Placed · COD", tone: "bg-forest/10 text-forest" },
  packed: { label: "Packed", tone: "bg-forest/10 text-forest" },
  shipped: { label: "On the way", tone: "bg-[#e8c879]/40 text-forest-deep" },
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

/** Phone + OTP sign-in (shadcn input-otp). */
function SignIn() {
  const [pending, start] = useTransition();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const send = () =>
    start(async () => {
      setError("");
      const r = await requestCustomerOtpAction({ phone });
      if (!r.ok) return setError(r.error ?? "Couldn't send the OTP.");
      setPhone(r.phone ?? phone);
      setSent(true);
    });
  const verify = () =>
    start(async () => {
      setError("");
      const r = await verifyCustomerOtpAction({ phone, code, name });
      if (!r.ok) return setError(r.error ?? "That code didn't work.");
      window.location.reload();
    });

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_24px_48px_-36px_rgba(7,47,27,0.5)] md:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-khaki-soft text-forest">
        <UserRound className="size-6" />
      </span>
      <h2 className="mt-4 text-2xl">{sent ? "Enter the OTP" : "Sign in with your phone"}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {sent ? (
          <>
            We sent a 6-digit code to <span className="font-semibold text-ink">+91 {phone}</span>.{" "}
            <button type="button" onClick={() => (setSent(false), setCode(""))} className="font-semibold text-forest underline-offset-2 hover:underline">
              Change
            </button>
          </>
        ) : (
          "See your orders, reorder in one tap and save addresses. No password needed."
        )}
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (sent) verify();
          else send();
        }}
      >
        {!sent ? (
          <label className="relative block">
            <span className="sr-only">Mobile number</span>
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] font-semibold text-ink-muted">+91</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              required
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile number"
              className={cn(field, "pl-14 tracking-wide")}
            />
          </label>
        ) : (
          <>
            <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={() => undefined} containerClassName="justify-center" autoFocus>
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="size-12 rounded-xl border border-line text-lg first:rounded-xl last:rounded-xl data-[active=true]:border-forest data-[active=true]:ring-forest/15" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (first time only)" autoComplete="name" className={field} />
          </>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || (!sent ? phone.length !== 10 : code.length !== 6)}
          className="btn-shine inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest text-sm font-bold text-white hover:bg-forest-mid disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {sent ? "Verify & sign in" : "Send OTP"}
        </button>
      </form>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
        <ShieldCheck className="size-3.5 text-forest" /> Guest checkout still works without an account.
      </p>
    </div>
  );
}

function Dashboard({ customer, orders, addresses }: { customer: { name: string; phone: string; email: string }; orders: Order[]; addresses: Address[] }) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const spent = orders.filter((o) => !["cancelled", "payment_failed", "pending_payment"].includes(o.status)).reduce((s, o) => s + o.total, 0);

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

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-forest p-6 text-white">
        <span className="grid size-14 place-items-center rounded-full bg-[#e8c879] text-xl font-extrabold text-forest-deep">{customer.name.trim()[0]?.toUpperCase() ?? "?"}</span>
        <div className="min-w-0 flex-1">
          <p className="font-hindi text-sm text-[#e8c879]" lang="hi">
            नमस्ते
          </p>
          <h2 className="truncate text-2xl text-white">{customer.name || "Welcome"}</h2>
          <p className="flex items-center gap-1.5 text-sm text-white/70">
            <Phone className="size-3.5" /> +91 {customer.phone}
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-2xl font-extrabold tabular-nums">{orders.length}</p>
            <p className="text-white/60">Orders</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold tabular-nums">{formatMoney(spent)}</p>
            <p className="text-white/60">Spent</p>
          </div>
        </div>
        <form action={logoutCustomerAction}>
          <button className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-semibold hover:bg-white/10">
            <LogOut className="size-4" /> Log out
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      {/* Orders */}
      <section className="rounded-3xl border border-line bg-white">
        <h3 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg">
          <Package className="size-5 text-forest/60" /> My orders
        </h3>
        {orders.length ? (
          <ul className="divide-y divide-line">
            {orders.map((o) => {
              const st = STATUS[o.status] ?? { label: o.status.replace(/_/g, " "), tone: "bg-subtle text-ink-muted" };
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold text-forest-text">{o.orderNo}</p>
                    <p className="text-xs text-ink-muted">{date(o.createdAt)}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.tone)}>{st.label}</span>
                  <span className="w-20 text-right text-sm font-bold tabular-nums">{formatMoney(o.total)}</span>
                  <div className="flex gap-2">
                    {o.token && (
                      <Link href={`/order?t=${o.token}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold text-forest-text hover:border-forest/40">
                        View <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reorder(o.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-3 text-xs font-bold text-white hover:bg-forest-mid disabled:opacity-60"
                    >
                      {busyId === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Reorder
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-forest-text">No orders yet</p>
            <Link href="/shop" className="mt-3 inline-flex h-10 items-center rounded-full bg-forest px-5 text-sm font-bold text-white">
              Start shopping
            </Link>
          </div>
        )}
      </section>

      {/* Addresses */}
      <section className="rounded-3xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg">
            <MapPin className="size-5 text-forest/60" /> Saved addresses
          </h3>
          <AddAddress />
        </div>
        {addresses.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((a, i) => (
              <li key={i} className="rounded-2xl border border-line bg-subtle p-4 text-sm leading-relaxed">
                <p className="font-semibold text-ink">{a.name}</p>
                <p className="text-ink">
                  {a.line1}, {a.city}
                </p>
                <p className="text-ink">
                  {a.state} {a.pincode}
                </p>
                <p className="text-ink-muted">{a.phone}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">No saved addresses yet.</p>
        )}
      </section>
    </div>
  );
}

function AddAddress() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-forest-text hover:border-forest/40">
          <Plus className="size-3.5" /> Add address
        </button>
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
