"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgePercent, Copy, IndianRupee, Loader2, MoreHorizontal, Pencil, Plus, Search, TicketPercent, Truck } from "lucide-react";
import { saveCouponAction } from "@/lib/coupon-actions";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Switch } from "@/components/shadcn/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { StatTile } from "@/components/admin/ui";

type Target = { kind: "product" | "collection"; handle: string };
type Coupon = {
  id: number;
  code: string;
  kind: "percent" | "flat" | "free_shipping";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perPhoneLimit: number | null;
  usedCount: number;
  redeemed: number;
  revenue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  targets: Target[];
};
type Choice = { handle: string; title: string };
type Status = "active" | "paused" | "scheduled" | "expired" | "used_up";
type Filter = "all" | Status;

const empty = {
  id: null as number | null,
  code: "",
  kind: "percent" as Coupon["kind"],
  value: 10,
  minSubtotal: 0,
  maxDiscount: null as number | null,
  firstOrderOnly: false,
  usageLimit: null as number | null,
  perPhoneLimit: null as number | null,
  startsAt: "",
  endsAt: "",
  active: true,
  targets: [] as Target[],
};
type Form = typeof empty;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const STATUS: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-forest/10 text-forest-fg" },
  paused: { label: "Paused", cls: "bg-khaki-soft text-ink-muted" },
  scheduled: { label: "Scheduled", cls: "bg-warm-strong text-sale" },
  expired: { label: "Expired", cls: "bg-alert-soft text-alert" },
  used_up: { label: "Used up", cls: "bg-alert-soft text-alert" },
};
const toTime = (s: string) => (s ? new Date(s.replace(" ", "T") + ":00+05:30").getTime() : NaN);
const offer = (c: Pick<Coupon, "kind" | "value">) =>
  c.kind === "percent" ? `${c.value}% off` : c.kind === "flat" ? `${formatMoney(c.value)} off` : "Free shipping";
const toForm = (c: Coupon): Form => ({
  id: c.id,
  code: c.code,
  kind: c.kind,
  value: c.value,
  minSubtotal: c.minSubtotal,
  maxDiscount: c.maxDiscount,
  firstOrderOnly: c.firstOrderOnly,
  usageLimit: c.usageLimit,
  perPhoneLimit: c.perPhoneLimit,
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  active: c.active,
  targets: c.targets,
});

export function CouponsWorkspace({ coupons, products, collections, now }: { coupons: Coupon[]; products: Choice[]; collections: Choice[]; now: number }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, start] = useTransition();

  const status = (c: Coupon): Status => {
    if (!c.active) return "paused";
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "used_up";
    if (toTime(c.endsAt) < now) return "expired";
    if (toTime(c.startsAt) > now) return "scheduled";
    return "active";
  };
  const counts = coupons.reduce<Record<string, number>>((m, c) => ((m[status(c)] = (m[status(c)] ?? 0) + 1), m), {});
  const shown = coupons.filter((c) => (filter === "all" || status(c) === filter) && c.code.toLowerCase().includes(q.trim().toLowerCase()));
  const redeemed = coupons.reduce((s, c) => s + c.redeemed, 0);
  const revenue = coupons.reduce((s, c) => s + c.revenue, 0);
  const best = [...coupons].sort((a, b) => b.redeemed - a.redeemed)[0];

  const toggle = (c: Coupon, on: boolean) => {
    setBusyId(c.id);
    start(async () => {
      const res = await saveCouponAction({ ...toForm(c), active: on });
      setBusyId(null);
      setToast(res.ok ? { ok: true, text: `${c.code} ${on ? "is live" : "paused"}` } : { ok: false, text: res.error ?? "Could not update" });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Coupons</h1>
          <p className="mt-1 text-sm text-ink-muted">Create clear offers and track how they do at checkout.</p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...empty })}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid"
        >
          <Plus className="size-4" />
          New coupon
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={TicketPercent} label="Live coupons" value={String(counts.active ?? 0)} note={`${coupons.length} total`} />
        <StatTile icon={BadgePercent} label="Orders with a coupon" value={String(redeemed)} note="All time" />
        <StatTile icon={IndianRupee} label="Coupon revenue" value={formatMoney(revenue)} note="Order totals" />
        <StatTile icon={TicketPercent} label="Top coupon" value={best?.redeemed ? best.code : "-"} note={best?.redeemed ? `${best.redeemed} orders` : "No redemptions yet"} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            {(["all", "active", "scheduled", "paused", "expired", "used_up"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap",
                  filter === f ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:text-forest-fg",
                )}
              >
                {f === "all" ? "All" : STATUS[f].label}
                <span className={filter === f ? "text-white/75" : "text-ink-muted/70"}>{f === "all" ? coupons.length : (counts[f] ?? 0)}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="relative sm:w-64">
          <span className="sr-only">Search coupons</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code" className={cn(input, "rounded-full pl-10")} />
        </label>
      </div>

      {toast && (
        <p role="status" className={cn("text-sm", toast.ok ? "text-forest-fg" : "text-alert")}>
          {toast.text}
        </p>
      )}

      {!shown.length ? (
        <div className={cn(card, "px-6 py-12 text-center")}>
          <p className="text-sm text-ink-muted">{coupons.length ? "No coupons match." : "No coupons yet. Create your first code."}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => {
            const s = status(c);
            const Icon = c.kind === "free_shipping" ? Truck : c.kind === "flat" ? IndianRupee : BadgePercent;
            return (
              <li key={c.id} className={cn(card, "flex flex-col p-4", s !== "active" && "opacity-90")}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-base font-bold tracking-wide text-forest-text">{c.code}</p>
                    <p className="text-sm font-medium text-ink">{offer(c)}{c.kind === "percent" && c.maxDiscount ? ` · max ${formatMoney(c.maxDiscount)}` : ""}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[s].cls)}>{STATUS[s].label}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft" aria-label={`Actions for ${c.code}`}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setForm(toForm(c))}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(c.code)}>
                        <Copy className="size-4" /> Copy code
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
                  <Chip>{c.minSubtotal ? `Min ${formatMoney(c.minSubtotal)}` : "No minimum"}</Chip>
                  {c.firstOrderOnly && <Chip>First order</Chip>}
                  <Chip>{c.targets.length ? `${c.targets.length} products/collections` : "All products"}</Chip>
                  {c.perPhoneLimit && <Chip>{c.perPhoneLimit}× per phone</Chip>}
                  {c.endsAt && <Chip>Ends {c.endsAt.slice(0, 10)}</Chip>}
                </div>

                {c.usageLimit ? (
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-forest" style={{ width: `${Math.min(100, (c.usedCount / c.usageLimit) * 100)}%` }} />
                    </div>
                  </div>
                ) : null}

                <div className="min-h-4 flex-1" />
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-xs text-ink-muted">
                    <span className="font-semibold text-ink tabular-nums">{c.usedCount}</span>
                    {c.usageLimit ? ` / ${c.usageLimit}` : ""} used · <span className="font-semibold text-ink">{formatMoney(c.revenue)}</span>
                  </p>
                  <span className="flex items-center gap-2">
                    {busyId === c.id && <Loader2 className="size-3.5 animate-spin text-ink-muted" />}
                    <Switch
                      checked={c.active}
                      disabled={busyId === c.id}
                      onCheckedChange={(on) => toggle(c, on)}
                      aria-label={c.active ? `Pause ${c.code}` : `Turn on ${c.code}`}
                      className="data-[state=checked]:bg-forest"
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto border-line bg-canvas p-0 sm:max-w-lg">
          {form && (
            <CouponForm
              form={form}
              setForm={setForm}
              products={products}
              collections={collections}
              onSaved={(code) => {
                setForm(null);
                setToast({ ok: true, text: `${code} saved` });
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-subtle px-2 py-0.5">{children}</span>;
}

function CouponForm({
  form,
  setForm,
  products,
  collections,
  onSaved,
}: {
  form: Form;
  setForm: (f: Form) => void;
  products: Choice[];
  collections: Choice[];
  onSaved: (code: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [targetQ, setTargetQ] = useState("");
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const key = (t: Target) => `${t.kind}:${t.handle}`;
  const selected = new Set(form.targets.map(key));
  const toggleTarget = (t: Target) => set({ targets: selected.has(key(t)) ? form.targets.filter((x) => key(x) !== key(t)) : [...form.targets, t] });
  const num = (v: string) => (v === "" ? null : Number(v));
  const match = (c: Choice) => c.title.toLowerCase().includes(targetQ.toLowerCase());

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await saveCouponAction({ ...form, value: form.kind === "free_shipping" ? 0 : Number(form.value) });
      if (!res.ok) return setError(res.error ?? "Could not save coupon.");
      onSaved(form.code);
    });
  };

  return (
    <form onSubmit={save} className="flex min-h-full flex-col">
      <SheetHeader className="border-b border-line bg-surface px-5 py-4">
        <SheetTitle className="text-lg font-bold text-forest-text">{form.id ? `Edit ${form.code}` : "New coupon"}</SheetTitle>
        <SheetDescription className="text-xs text-ink-muted">Shoppers type this code at checkout.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 px-5 py-5">
        <Field label="Coupon code">
          <input
            required
            maxLength={30}
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })}
            placeholder="WELCOME10"
            className={cn(input, "font-mono tracking-wide uppercase")}
          />
        </Field>

        <Field label="Offer type">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
            {(
              [
                ["percent", "% off"],
                ["flat", "₹ off"],
                ["free_shipping", "Free ship"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => set({ kind: k })}
                className={cn("h-8 rounded-lg text-xs font-semibold", form.kind === k ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg")}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {form.kind !== "free_shipping" && (
            <Field label={form.kind === "percent" ? "Percent off" : "Amount off (₹)"}>
              <input type="number" required min={1} max={form.kind === "percent" ? 100 : 100000} value={form.value} onChange={(e) => set({ value: Number(e.target.value) })} className={input} />
            </Field>
          )}
          {form.kind === "percent" && (
            <Field label="Max discount (₹)">
              <input type="number" min={1} value={form.maxDiscount ?? ""} onChange={(e) => set({ maxDiscount: num(e.target.value) })} placeholder="No cap" className={input} />
            </Field>
          )}
          <Field label="Minimum order (₹)">
            <input type="number" min={0} value={form.minSubtotal} onChange={(e) => set({ minSubtotal: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Total uses">
            <input type="number" min={1} value={form.usageLimit ?? ""} onChange={(e) => set({ usageLimit: num(e.target.value) })} placeholder="Unlimited" className={input} />
          </Field>
          <Field label="Uses per phone">
            <input type="number" min={1} value={form.perPhoneLimit ?? ""} onChange={(e) => set({ perPhoneLimit: num(e.target.value) })} placeholder="Unlimited" className={input} />
          </Field>
        </div>
        {form.kind === "percent" && form.value > 25 && (
          <p className="rounded-xl border border-warm-line bg-warm px-3 py-2 text-xs text-sale">Over 25% off. Keep discounts sober unless this is planned.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={input} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={input} />
          </Field>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          <Toggle label="First order only" hint="Only for phones with no earlier order" checked={form.firstOrderOnly} onChange={(v) => set({ firstOrderOnly: v })} />
          <Toggle label="Active" hint="Off = code stops working at checkout" checked={form.active} onChange={(v) => set({ active: v })} />
        </div>

        <Field label={`Applies to ${form.targets.length ? `(${form.targets.length} selected)` : "(all products)"}`}>
          <div className="rounded-xl border border-line bg-surface">
            <input value={targetQ} onChange={(e) => setTargetQ(e.target.value)} placeholder="Search products or collections" className="h-10 w-full border-b border-line bg-transparent px-3.5 text-sm outline-none" />
            <div className="max-h-56 overflow-y-auto p-1.5" data-lenis-prevent="">
              {[...collections.filter(match).map((c) => ({ ...c, kind: "collection" as const })), ...products.filter(match).map((p) => ({ ...p, kind: "product" as const }))].map((t) => (
                <label key={`${t.kind}:${t.handle}`} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle">
                  <input type="checkbox" checked={selected.has(`${t.kind}:${t.handle}`)} onChange={() => toggleTarget({ kind: t.kind, handle: t.handle })} className="size-4 accent-forest" />
                  <span className="flex-1 truncate text-ink">{t.title}</span>
                  <span className="text-[10px] text-ink-muted uppercase">{t.kind}</span>
                </label>
              ))}
            </div>
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-surface px-5 py-3">
        {error && <p className="flex-1 text-xs text-alert">{error}</p>}
        <span className="flex-1" />
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {form.id ? "Save coupon" : "Create coupon"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-forest" aria-label={label} />
    </div>
  );
}
