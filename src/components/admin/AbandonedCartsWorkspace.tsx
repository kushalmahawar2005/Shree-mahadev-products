"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  Gift,
  IndianRupee,
  Loader2,
  MessageCircle,
  Search,
  ShoppingCart,
  UserPlus,
  X,
} from "lucide-react";
import { markReminderSentAction } from "@/lib/admin-actions";
import { markLeadContactedAction, saveLeadPopupAction } from "@/lib/lead-actions";
import type { LeadPopupConfig } from "@/lib/lead-popup";
import type { AdminLead } from "@/lib/server/leads";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Switch } from "@/components/shadcn/switch";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { CopyButton } from "./order/CopyButton";

export type CartRow = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  pincode: string | null;
  subtotal: number;
  status: "abandoned" | "recovered";
  stage: string;
  stageTone: "alert" | "warm" | "muted";
  linkOpened: boolean;
  orderNo: string | null;
  reminderCount: number;
  lastActive: string;
  items: { title: string; variant: string; qty: number }[];
  waHref: string | null;
};
export type LeadRow = AdminLead & { captured: string; waHref: string };
type CouponOption = { code: string; percent: number; active: boolean };

type View = "carts" | "leads";
type CartFilter = "all" | "reachable" | "anonymous" | "messaged" | "recovered";
type LeadFilter = "all" | "new" | "contacted" | "ordered";

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const PAGE = 25;
const DELAYS = [5, 10, 15, 20, 30, 45, 60];

export function AbandonedCartsWorkspace({
  carts,
  leads,
  popup,
  coupons,
}: {
  carts: CartRow[];
  leads: LeadRow[];
  popup: LeadPopupConfig;
  coupons: CouponOption[];
}) {
  const [view, setView] = useState<View>("carts");
  const [q, setQ] = useState("");

  const open = carts.filter((c) => c.status === "abandoned");
  const recovered = carts.filter((c) => c.status === "recovered");
  const reachable = open.filter((c) => c.phone);
  const contacted = carts.filter((c) => c.reminderCount > 0);
  const ordered = leads.filter((l) => l.orderNo);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <Stat icon={ShoppingCart} label="Open carts" value={String(open.length)} note={`${reachable.length} with phone`} />
        <Stat
          icon={IndianRupee}
          label="Value at risk"
          value={formatMoney(open.reduce((s, c) => s + c.subtotal, 0))}
          note={`${formatMoney(reachable.reduce((s, c) => s + c.subtotal, 0))} reachable`}
          tone={open.length ? "warn" : undefined}
        />
        <Stat
          icon={CheckCircle2}
          label="Recovered"
          value={String(recovered.length)}
          note={contacted.length ? `${Math.round((recovered.length / contacted.length) * 100)}% of carts messaged` : "No carts messaged yet"}
        />
        <Stat
          icon={UserPlus}
          label="Leads (90 days)"
          value={String(leads.length)}
          note={leads.length ? `${ordered.length} ordered · ${Math.round((ordered.length / leads.length) * 100)}%` : "From the welcome popup"}
        />
      </section>

      <PopupControl popup={popup} coupons={coupons} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full rounded-full border border-line bg-surface p-1 sm:w-auto" role="tablist">
          {(
            [
              ["carts", "Carts", open.length + recovered.length, ShoppingCart],
              ["leads", "Leads", leads.length, UserPlus],
            ] as const
          ).map(([v, label, n, Icon]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors sm:flex-none",
                view === v ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg",
              )}
            >
              <Icon className="size-4" />
              {label}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", view === v ? "bg-white/20" : "bg-khaki-soft")}>{n}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={view === "carts" ? "Name, phone or product" : "Name or phone"}
            className="h-10 w-full rounded-full border border-line bg-surface pr-9 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-forest-fg focus:ring-2 focus:ring-forest/15"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      </div>

      {view === "carts" ? <CartsView carts={carts} q={q} /> : <LeadsView leads={leads} q={q} />}
    </div>
  );
}

/* ───────────── Welcome popup control ───────────── */

function PopupControl({ popup, coupons }: { popup: LeadPopupConfig; coupons: CouponOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(popup);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = draft.delaySec !== popup.delaySec || draft.couponCode !== popup.couponCode;
  const coupon = coupons.find((c) => c.code === draft.couponCode);
  const usable = coupons.filter((c) => c.active || c.code === popup.couponCode);
  const live = popup.enabled && !!coupons.find((c) => c.code === popup.couponCode)?.active;

  const save = (next: LeadPopupConfig, ok: string) =>
    start(async () => {
      setMsg(null);
      try {
        await saveLeadPopupAction(next);
        setDraft(next);
        setMsg({ ok: true, text: ok });
        router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message.replace(/^\[.*?\]\s*/, "") || "Could not save" });
      }
    });

  return (
    <section className={cn(card, "p-4 sm:p-5")} aria-label="Welcome offer popup">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-forest-text">Welcome offer popup</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                live ? "bg-forest/10 text-forest-fg" : "bg-khaki-soft text-ink-muted",
              )}
            >
              <span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-forest-fg" : "bg-ink-muted")} />
              {live ? "Live" : popup.enabled ? "Coupon inactive" : "Paused"}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            New visitors see it once after {popup.delaySec}s. They enter name + phone and get the coupon code. Their number also shows on their cart here.
          </p>
        </div>
        <Switch
          checked={popup.enabled}
          disabled={pending}
          onCheckedChange={(on) => save({ ...draft, enabled: on }, on ? "Popup is live on the store" : "Popup paused")}
          aria-label={popup.enabled ? "Pause popup" : "Start popup"}
          className="mt-1 data-[state=checked]:bg-forest"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Discount coupon</p>
          {usable.length ? (
            <Select value={draft.couponCode || undefined} onValueChange={(v) => setDraft({ ...draft, couponCode: v })}>
              <SelectTrigger className="h-10 w-full rounded-xl border-line bg-surface">
                <SelectValue placeholder="Pick a percent coupon" />
              </SelectTrigger>
              <SelectContent>
                {usable.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="font-mono font-semibold">{c.code}</span>
                    <span className="text-ink-muted">· {c.percent}% off{c.active ? "" : " · inactive"}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="flex h-10 items-center rounded-xl border border-dashed border-line px-3 text-sm text-ink-muted">
              No percent coupon yet.&nbsp;
              <Link href="/admin/discounts" className="font-semibold text-forest-fg underline-offset-2 hover:underline">
                Create one
              </Link>
            </p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Show after</p>
          <Select value={String(draft.delaySec)} onValueChange={(v) => setDraft({ ...draft, delaySec: Number(v) })}>
            <SelectTrigger className="h-10 w-full rounded-xl border-line bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...new Set([...DELAYS, popup.delaySec])].sort((a, b) => a - b).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} seconds
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(popup)}
              className="h-10 flex-1 rounded-full border border-line px-4 text-sm font-semibold text-ink-muted hover:bg-khaki-soft sm:flex-none"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => save({ ...draft, enabled: popup.enabled }, "Popup settings saved")}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50 sm:flex-none"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
      {coupon && !coupon.active && <p className="mt-2 text-xs text-sale">This coupon is inactive or expired, so the popup stays hidden. Pick another or turn the coupon on.</p>}
      {msg && (
        <p role="status" className={cn("mt-2 text-xs", msg.ok ? "text-forest-fg" : "text-alert")}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

/* ───────────── Carts ───────────── */

function CartsView({ carts, q }: { carts: CartRow[]; q: string }) {
  const [filter, setFilter] = useState<CartFilter>(() => (carts.some((c) => c.phone && c.status === "abandoned") ? "reachable" : "all"));
  const [limit, setLimit] = useState(PAGE);

  const tests: Record<CartFilter, (c: CartRow) => boolean> = {
    all: () => true,
    reachable: (c) => c.status === "abandoned" && !!c.phone,
    anonymous: (c) => c.status === "abandoned" && !c.phone,
    messaged: (c) => c.status === "abandoned" && c.reminderCount > 0,
    recovered: (c) => c.status === "recovered",
  };
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return carts.filter(
      (c) =>
        tests[filter](c) &&
        (!needle || `${c.name ?? ""} ${c.phone ?? ""} ${c.email ?? ""} ${c.items.map((i) => i.title).join(" ")}`.toLowerCase().includes(needle)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tests is static per filter
  }, [carts, filter, q]);

  const pills: [CartFilter, string][] = [
    ["reachable", "With phone"],
    ["anonymous", "Anonymous"],
    ["messaged", "Messaged"],
    ["recovered", "Recovered"],
    ["all", "All"],
  ];

  return (
    <div className="space-y-3">
      <FilterPills value={filter} onChange={(f) => (setFilter(f), setLimit(PAGE))} pills={pills.map(([f, l]) => [f, l, carts.filter(tests[f]).length])} />
      {!shown.length ? (
        <Empty
          text={
            filter === "reachable"
              ? "No open carts with a phone number. Turn on the welcome popup to collect more numbers."
              : "Nothing here yet."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className={cn(card, "hidden overflow-hidden lg:block")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Recover</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((c) => (
                  <tr key={c.id} className="border-b border-line align-top last:border-0 hover:bg-subtle">
                    <td className="px-4 py-3.5">
                      <Who name={c.name} phone={c.phone} sub={[c.email, c.pincode && `PIN ${c.pincode}`].filter(Boolean).join(" · ")} />
                    </td>
                    <td className="max-w-[320px] px-4 py-3.5">
                      <Items items={c.items} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap text-ink tabular-nums">{formatMoney(c.subtotal)}</td>
                    <td className="px-4 py-3.5">
                      <Stage row={c} />
                    </td>
                    <td className="px-4 py-3.5">
                      <CartStatus row={c} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <CartAction row={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2.5 lg:hidden">
            {shown.slice(0, limit).map((c) => (
              <li key={c.id} className={cn(card, "p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <Who name={c.name} phone={c.phone} sub={c.pincode ? `PIN ${c.pincode}` : ""} />
                  <span className="shrink-0 text-base font-bold text-ink tabular-nums">{formatMoney(c.subtotal)}</span>
                </div>
                <div className="mt-3 rounded-xl bg-subtle px-3 py-2.5">
                  <Items items={c.items} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Stage row={c} inline />
                  <CartStatus row={c} />
                </div>
                {c.waHref && (
                  <div className="mt-3">
                    <CartAction row={c} block />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <More total={shown.length} limit={limit} onMore={() => setLimit((l) => l + PAGE)} />
        </>
      )}
    </div>
  );
}

function Stage({ row, inline }: { row: CartRow; inline?: boolean }) {
  return (
    <span className={cn("text-sm", inline && "inline-flex items-center gap-2")}>
      <span
        className={cn(
          "font-medium",
          row.stageTone === "alert" ? "text-alert" : row.stageTone === "warm" ? "text-sale" : "text-ink",
        )}
      >
        {row.stage}
      </span>
      <span className={cn("text-xs text-ink-muted", !inline && "block")}>
        {inline && "· "}
        {row.lastActive}
        {row.linkOpened && " · opened link"}
      </span>
    </span>
  );
}

function CartStatus({ row }: { row: CartRow }) {
  if (row.status === "recovered") return <Pill tone="green">Recovered {row.orderNo ?? ""}</Pill>;
  if (row.reminderCount) return <Pill tone="gray">Messaged ×{row.reminderCount}</Pill>;
  return <Pill tone={row.phone ? "amber" : "muted"}>{row.phone ? "Not contacted" : "No contact"}</Pill>;
}

function CartAction({ row, block }: { row: CartRow; block?: boolean }) {
  const [pending, start] = useTransition();
  if (!row.waHref) return <span className="text-ink-muted">-</span>;
  return (
    <WhatsAppLink
      href={row.waHref}
      label={row.reminderCount ? "Remind again" : "WhatsApp"}
      pending={pending}
      block={block}
      onClick={() => start(() => markReminderSentAction(row.id))}
    />
  );
}

/* ───────────── Leads ───────────── */

function LeadsView({ leads, q }: { leads: LeadRow[]; q: string }) {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const tests: Record<LeadFilter, (l: LeadRow) => boolean> = {
    all: () => true,
    new: (l) => !l.orderNo && !l.contactedAt,
    contacted: (l) => !l.orderNo && !!l.contactedAt,
    ordered: (l) => !!l.orderNo,
  };
  const needle = q.trim().toLowerCase();
  const shown = leads.filter((l) => tests[filter](l) && (!needle || `${l.name} ${l.phone}`.toLowerCase().includes(needle)));

  return (
    <div className="space-y-3">
      <FilterPills
        value={filter}
        onChange={(f) => (setFilter(f), setLimit(PAGE))}
        pills={(
          [
            ["all", "All"],
            ["new", "New"],
            ["contacted", "Contacted"],
            ["ordered", "Ordered"],
          ] as [LeadFilter, string][]
        ).map(([f, l]) => [f, l, leads.filter(tests[f]).length])}
      />
      {!shown.length ? (
        <Empty text={leads.length ? "No leads match." : "No leads yet. Turn on the welcome offer popup above to start collecting names and numbers."} />
      ) : (
        <>
          <div className={cn(card, "hidden overflow-hidden lg:block")}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Captured</th>
                  <th className="px-4 py-3 font-medium">Page</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Follow up</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, limit).map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-subtle">
                    <td className="px-4 py-3">
                      <Who name={l.name} phone={l.phone} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{l.captured}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted">{l.page ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">{l.couponCode ?? "-"}</td>
                    <td className="px-4 py-3">
                      <LeadStatus lead={l} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LeadAction lead={l} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2.5 lg:hidden">
            {shown.slice(0, limit).map((l) => (
              <li key={l.id} className={cn(card, "p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <Who name={l.name} phone={l.phone} sub={`${l.captured}${l.page ? ` · ${l.page}` : ""}`} />
                  <LeadStatus lead={l} />
                </div>
                {!l.orderNo && (
                  <div className="mt-3">
                    <LeadAction lead={l} block />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <More total={shown.length} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
        </>
      )}
    </div>
  );
}

function LeadStatus({ lead }: { lead: LeadRow }) {
  if (lead.orderNo) return <Pill tone="green">Ordered {lead.orderNo}</Pill>;
  if (lead.contactedAt) return <Pill tone="gray">Contacted</Pill>;
  return <Pill tone="amber">New</Pill>;
}

function LeadAction({ lead, block }: { lead: LeadRow; block?: boolean }) {
  const [pending, start] = useTransition();
  if (lead.orderNo) return <span className="text-ink-muted">-</span>;
  return (
    <WhatsAppLink
      href={lead.waHref}
      label={lead.contactedAt ? "Message again" : "WhatsApp"}
      pending={pending}
      block={block}
      onClick={() => start(() => markLeadContactedAction(lead.id))}
    />
  );
}

/* ───────────── Shared bits ───────────── */

function Stat({ icon: Icon, label, value, note, tone }: { icon: typeof Gift; label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className={cn(card, "flex items-center gap-3 p-3.5 sm:p-4", tone === "warn" && "border-warm-line")}>
      <span
        className={cn(
          "hidden size-10 shrink-0 place-items-center rounded-xl sm:grid",
          tone === "warn" ? "bg-warm-strong text-sale" : "bg-khaki-soft text-forest-fg",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate text-lg font-bold tracking-tight text-forest-text tabular-nums sm:text-xl">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{note}</p>
      </div>
    </div>
  );
}

function FilterPills<T extends string>({ value, onChange, pills }: { value: T; onChange: (v: T) => void; pills: [T, string, number][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        {pills.map(([v, label, n]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
              value === v ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:text-forest-fg",
            )}
          >
            {label}
            <span className={cn("tabular-nums", value === v ? "text-white/75" : "text-ink-muted/70")}>{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Who({ name, phone, sub }: { name: string | null; phone: string | null; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className={cn("truncate font-semibold", name ? "text-ink" : "text-ink-muted")}>{name ?? "Anonymous visitor"}</p>
      {phone ? (
        <p className="flex items-center gap-0.5 text-sm text-ink-muted tabular-nums">
          +91 {phone}
          <CopyButton value={phone} label="phone" className="size-6" />
        </p>
      ) : (
        <p className="text-sm text-ink-muted">No contact yet</p>
      )}
      {sub && <p className="truncate text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

function Items({ items }: { items: CartRow["items"] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((i) => (
        <li key={i.title + i.variant} className="text-sm text-ink">
          <span className="font-semibold tabular-nums">{i.qty}×</span> {i.title} <span className="text-ink-muted">({i.variant})</span>
        </li>
      ))}
    </ul>
  );
}

const pillTones = {
  green: "bg-forest/10 text-forest-fg",
  amber: "bg-warm-strong text-sale",
  gray: "bg-khaki-soft text-ink",
  muted: "bg-subtle text-ink-muted border border-line",
};
function Pill({ tone, children }: { tone: keyof typeof pillTones; children: React.ReactNode }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", pillTones[tone])}>{children}</span>;
}

function WhatsAppLink({ href, label, pending, block, onClick }: { href: string; label: string; pending: boolean; block?: boolean; onClick: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      aria-disabled={pending}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-mid aria-disabled:opacity-60",
        block && "h-10 w-full",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      {label}
    </a>
  );
}

function Empty({ text }: { text: string }) {
  return <p className={cn(card, "px-5 py-10 text-center text-sm text-ink-muted")}>{text}</p>;
}

function More({ total, limit, onMore }: { total: number; limit: number; onMore: () => void }) {
  return (
    <AnimatePresence>
      {total > limit && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onMore}
            className="h-10 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-forest-fg hover:bg-khaki-soft"
          >
            Show more · {total - limit} left
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
