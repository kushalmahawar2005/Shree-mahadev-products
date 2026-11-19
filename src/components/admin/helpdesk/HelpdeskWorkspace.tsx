"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  ExternalLink,
  HelpCircle,
  Inbox,
  Loader2,
  MessageCircle,
  PackageCheck,
  PackageOpen,
  Phone,
  Search,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  X,
} from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { notifyWaitlistAction, setReturnStatusAction, setTicketStatusAction } from "@/lib/helpdesk-actions";
import type { AdminReturn, AdminTicket, ReturnStatus, TicketStatus, WaitlistGroup } from "@/lib/server/helpdesk";
import { ConfirmAction } from "@/components/admin/order/ConfirmAction";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { StatTile } from "@/components/admin/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type HelpdeskTab = "returns" | "tickets" | "waitlist" | "faq";
type Faq = { faqId: string; question: string; helpful: number; notHelpful: number; updatedAt: string };
type Notice = { ok: boolean; text: string } | null;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const pillBtn = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60";
const ghost = cn(pillBtn, "border border-line bg-surface text-ink hover:bg-khaki-soft");
const primary = cn(pillBtn, "bg-forest text-white hover:bg-forest-mid");

/** DB returns IST wall-clock strings ("2026-11-13 12:45:00"). */
const ist = (s: string) => new Date(String(s).replace(" ", "T").slice(0, 19) + "+05:30");
const when = (s: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ist(s));
const ago = (s: string) => {
  const m = Math.max(0, Math.round((Date.now() - ist(s).getTime()) / 60000));
  if (m < 60) return `${m || 1}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const wa = (phone: string, text: string) => `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;

const RETURN_LABEL: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  received: "Received",
  refunded: "Refunded",
  rejected: "Rejected",
};
const RETURN_TONE: Record<ReturnStatus, string> = {
  requested: "bg-warm text-sale border-warm-line",
  approved: "bg-khaki-soft text-forest-fg border-line",
  received: "bg-khaki-soft text-forest-fg border-line",
  refunded: "bg-forest/10 text-forest-fg border-forest/20",
  rejected: "bg-subtle text-ink-muted border-line",
};
const TICKET_LABEL: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved" };
const TICKET_TONE: Record<TicketStatus, string> = {
  open: "bg-warm text-sale border-warm-line",
  in_progress: "bg-khaki-soft text-forest-fg border-line",
  resolved: "bg-forest/10 text-forest-fg border-forest/20",
};

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold", tone)}>{children}</span>;
}

function Thumb({ src, alt, size = 44 }: { src: string | null; alt: string; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-subtle" style={{ width: size, height: size }}>
      {src ? <Image src={src} alt={alt} width={size * 2} height={size * 2} className="size-full object-cover" /> : <PackageOpen className="size-4 text-ink-muted" />}
    </span>
  );
}

function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex w-max rounded-full border border-line bg-surface p-1" role="tablist" aria-label={label}>
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={cn("relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold", value === t.id ? "text-white" : "text-ink-muted hover:text-forest-fg")}
          >
            {value === t.id && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
            <span className="relative">{t.label}</span>
            {t.count !== undefined && (
              <span className={cn("relative rounded-full px-1.5 text-[11px] tabular-nums", value === t.id ? "bg-white/20" : "bg-khaki-soft")}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block lg:ml-auto lg:w-72">
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-line bg-surface pr-9 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted hover:text-ink">
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}

function Empty({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-khaki-soft text-forest-fg">
        <Icon className="size-5" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-muted">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

/* ───────────── Workspace ───────────── */

export function HelpdeskWorkspace({
  returns,
  tickets,
  waitlist,
  faqs,
  initialTab,
}: {
  returns: AdminReturn[];
  tickets: AdminTicket[];
  waitlist: WaitlistGroup[];
  faqs: Faq[];
  initialTab?: HelpdeskTab;
}) {
  const router = useRouter();
  const openReturns = returns.filter((r) => r.status === "requested" || r.status === "approved" || r.status === "received").length;
  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const waiting = waitlist.reduce((s, g) => s + g.waiting, 0);
  const [tab, setTab] = useState<HelpdeskTab>(initialTab ?? (openReturns || !openTickets ? "returns" : "tickets"));
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>, ok: string, after?: () => void) =>
    start(async () => {
      setNotice(null);
      try {
        await fn();
        setNotice({ ok: true, text: ok });
        after?.();
        router.refresh();
      } catch (e) {
        setNotice({ ok: false, text: e instanceof Error ? e.message : "Could not save this change." });
      }
    });

  const selectTab = (t: HelpdeskTab) => {
    setTab(t);
    setNotice(null);
    window.history.replaceState(null, "", `?tab=${t}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-forest-text">Help desk</h1>
        <p className="mt-1 text-sm text-ink-muted">Returns, customer help requests and restock waitlists in one place.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={Undo2} label="Returns to handle" value={String(openReturns)} note={`${returns.length} total`} tone={openReturns ? "warn" : undefined} />
        <StatTile icon={Inbox} label="Open tickets" value={String(openTickets)} note={`${tickets.filter((t) => t.status === "open").length} not started`} tone={openTickets ? "warn" : undefined} />
        <StatTile icon={BellRing} label="Waiting for restock" value={String(waiting)} note={`${waitlist.filter((g) => g.waiting).length} products`} />
        <StatTile
          icon={HelpCircle}
          label="FAQ helpful"
          value={(() => {
            const h = faqs.reduce((s, f) => s + f.helpful, 0);
            const all = h + faqs.reduce((s, f) => s + f.notHelpful, 0);
            return all ? `${Math.round((h / all) * 100)}%` : "-";
          })()}
          note={`${faqs.reduce((s, f) => s + f.helpful + f.notHelpful, 0)} votes`}
        />
      </section>

      <Segmented
        label="Help desk section"
        value={tab}
        onChange={selectTab}
        items={[
          { id: "returns", label: "Returns", count: openReturns },
          { id: "tickets", label: "Tickets", count: openTickets },
          { id: "waitlist", label: "Back in stock", count: waiting },
          { id: "faq", label: "FAQ feedback" },
        ]}
      />

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role={notice.ok ? "status" : "alert"}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
              notice.ok ? "border-forest/20 bg-forest/10 text-forest-fg" : "border-warm-line bg-warm text-sale",
            )}
          >
            {notice.ok ? <Check className="size-4" /> : <X className="size-4" />} {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {tab === "returns" && <ReturnsView returns={returns} run={run} pending={pending} />}
      {tab === "tickets" && <TicketsView tickets={tickets} run={run} pending={pending} />}
      {tab === "waitlist" && <WaitlistView groups={waitlist} run={run} pending={pending} />}
      {tab === "faq" && <FaqView faqs={faqs} />}
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, ok: string, after?: () => void) => void;

/* ───────────── Returns ───────────── */

function ReturnsView({ returns, run, pending }: { returns: AdminReturn[]; run: Run; pending: boolean }) {
  const [filter, setFilter] = useState<"open" | ReturnStatus | "all">("open");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = returns.filter(
    (r) =>
      (filter === "all" || (filter === "open" ? ["requested", "approved", "received"].includes(r.status) : r.status === filter)) &&
      (!needle || `${r.orderNo} ${r.customerName} ${r.phone} ${r.reason}`.toLowerCase().includes(needle)),
  );
  const current = returns.find((r) => r.id === openId) ?? null;
  const count = (s: ReturnStatus) => returns.filter((r) => r.status === s).length;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="Return status"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "open", label: "To handle" },
            { id: "requested", label: "Requested", count: count("requested") },
            { id: "approved", label: "Approved", count: count("approved") },
            { id: "refunded", label: "Refunded", count: count("refunded") },
            { id: "rejected", label: "Rejected", count: count("rejected") },
            { id: "all", label: "All" },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Order, name, phone" />
      </div>

      <div className={card}>
        {shown.length === 0 ? (
          <Empty icon={Undo2} title={returns.length ? "Nothing here" : "No returns yet"} hint={returns.length ? "Try another filter or search." : "When a customer asks to return a delivered order, it shows up here."} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5">
                <div className="flex -space-x-3">
                  {r.items.slice(0, 3).map((i) => (
                    <Thumb key={i.variantKey} src={i.image} alt={i.title} size={40} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setOpenId(r.id)} className="text-left font-semibold text-ink after:absolute after:inset-0">
                    {r.orderNo} · {r.customerName}
                  </button>
                  <p className="truncate text-sm text-ink-muted">
                    {r.reason} · {r.items.reduce((s, i) => s + i.qty, 0)} item(s)
                  </p>
                </div>
                <span className="hidden text-xs text-ink-muted sm:block">{ago(r.createdAt)}</span>
                <Pill tone={RETURN_TONE[r.status]}>{RETURN_LABEL[r.status]}</Pill>
                <ChevronRight className="size-4 text-ink-muted" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && <ReturnDetail r={current} run={run} pending={pending} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ReturnDetail({ r, run, pending }: { r: AdminReturn; run: Run; pending: boolean }) {
  const set = (status: ReturnStatus, ok: string, note?: string) => run(async () => unwrap(await setReturnStatusAction(r.id, status, note)), ok);
  const value = r.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  return (
    <>
      <SheetHeader className="border-b border-line">
        <div className="flex items-center gap-2">
          <SheetTitle>Return for {r.orderNo}</SheetTitle>
          <Pill tone={RETURN_TONE[r.status]}>{RETURN_LABEL[r.status]}</Pill>
        </div>
        <SheetDescription>Requested {when(r.createdAt)}</SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Items to return</h3>
          <ul className="space-y-2">
            {r.items.map((i) => (
              <li key={i.variantKey} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
                <Thumb src={i.image} alt={i.title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{i.title}</p>
                  <p className="text-xs text-ink-muted">{i.variant}</p>
                </div>
                <p className="text-sm tabular-nums text-ink">
                  {i.qty} × {formatMoney(i.unitPrice)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-right text-sm text-ink-muted">
            Item value <span className="font-semibold text-ink tabular-nums">{formatMoney(value)}</span> · order total {formatMoney(r.orderTotal)}
          </p>
        </section>

        <section className="rounded-xl bg-subtle p-3.5">
          <p className="text-sm font-semibold text-ink">{r.reason}</p>
          <p className="mt-1 text-sm text-ink-muted">{r.note || "No note from the customer."}</p>
        </section>

        <section className="divide-y divide-line rounded-xl border border-line px-3.5">
          <Field label="Customer">{r.customerName}</Field>
          <Field label="Phone">
            <span className="inline-flex items-center gap-1">
              {r.phone} <CopyButton value={r.phone} label="Copy phone" />
            </span>
          </Field>
          <Field label="Email">{r.email}</Field>
          <Field label="Payment">{r.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"}</Field>
        </section>

        <div className="flex flex-wrap gap-2">
          <a
            href={wa(r.phone, `Namaste ${r.customerName}, this is Shree Mahadev Products about your return for order ${r.orderNo}.`)}
            target="_blank"
            rel="noreferrer"
            className={ghost}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <Link href={`/admin/orders/view?id=${r.orderId}`} className={ghost}>
            <ExternalLink className="size-4" /> Open order
          </Link>
        </div>

        <section className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Next step</h3>
          {r.status === "requested" && (
            <div className="flex flex-wrap gap-2">
              <ConfirmAction
                trigger={<button type="button" disabled={pending} className={primary}><Check className="size-4" /> Approve return</button>}
                title="Approve this return?"
                description="Arrange the pickup or ask the customer to send the items back. The order timeline is updated."
                confirmLabel="Approve"
                onConfirm={() => set("approved", `Return for ${r.orderNo} approved`)}
              />
              <ConfirmAction
                trigger={<button type="button" disabled={pending} className={ghost}><X className="size-4" /> Reject</button>}
                title="Reject this return?"
                description="The reason is saved on the order timeline. Let the customer know on WhatsApp."
                confirmLabel="Reject return"
                destructive
                reasonLabel="Reason for the customer"
                onConfirm={(why) => set("rejected", `Return for ${r.orderNo} rejected`, why)}
              />
            </div>
          )}
          {r.status === "approved" && (
            <div className="flex flex-wrap gap-2">
              <ConfirmAction
                trigger={<button type="button" disabled={pending} className={primary}><PackageCheck className="size-4" /> Mark items received</button>}
                title="Items received back?"
                description="Confirm the returned items reached you. Stock is not changed automatically; adjust it on the Inventory page if the items can be resold."
                confirmLabel="Mark received"
                onConfirm={() => set("received", `Items for ${r.orderNo} received`)}
              />
              <ConfirmAction
                trigger={<button type="button" disabled={pending} className={ghost}><X className="size-4" /> Reject</button>}
                title="Reject this return?"
                description="The reason is saved on the order timeline."
                confirmLabel="Reject return"
                destructive
                reasonLabel="Reason for the customer"
                onConfirm={(why) => set("rejected", `Return for ${r.orderNo} rejected`, why)}
              />
            </div>
          )}
          {r.status === "received" && (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">
                Issue the money first from the order page (Payment → Refund), then mark this return refunded. A credit note is created for refunded returns.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/orders/view?id=${r.orderId}#payment`} className={ghost}>
                  <ExternalLink className="size-4" /> Refund on order page
                </Link>
                <ConfirmAction
                  trigger={<button type="button" disabled={pending} className={primary}><CheckCircle2 className="size-4" /> Mark refunded</button>}
                  title="Mark this return refunded?"
                  description="Only do this after the money has been sent back to the customer."
                  confirmLabel="Mark refunded"
                  onConfirm={() => set("refunded", `Return for ${r.orderNo} marked refunded`)}
                />
              </div>
            </div>
          )}
          {(r.status === "refunded" || r.status === "rejected") && (
            <p className="text-sm text-ink-muted">This return is closed ({RETURN_LABEL[r.status].toLowerCase()} {when(r.updatedAt)}).</p>
          )}
          {pending && <Loader2 className="size-4 animate-spin text-ink-muted" />}
        </section>
      </div>
    </>
  );
}

/* ───────────── Tickets ───────────── */

function TicketsView({ tickets, run, pending }: { tickets: AdminTicket[]; run: Run; pending: boolean }) {
  const [filter, setFilter] = useState<TicketStatus | "all">(tickets.some((t) => t.status === "open") ? "open" : "all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = tickets.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (!needle || `${t.ticketNo} ${t.customerName} ${t.phone} ${t.orderNo ?? ""} ${t.issueLabel} ${t.message}`.toLowerCase().includes(needle)),
  );
  const current = tickets.find((t) => t.id === openId) ?? null;
  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="Ticket status"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "open", label: "Open", count: count("open") },
            { id: "in_progress", label: "In progress", count: count("in_progress") },
            { id: "resolved", label: "Resolved", count: count("resolved") },
            { id: "all", label: "All", count: tickets.length },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Ticket, name, phone, order" />
      </div>

      <div className={card}>
        {shown.length === 0 ? (
          <Empty icon={Inbox} title={tickets.length ? "Nothing here" : "Inbox zero"} hint={tickets.length ? "Try another filter or search." : "Help requests from the account Help page land here."} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <li key={t.id} className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", t.status === "open" ? "bg-warm text-sale" : "bg-khaki-soft text-forest-fg")}>
                  {t.status === "resolved" ? <CheckCircle2 className="size-4" /> : t.status === "in_progress" ? <Clock className="size-4" /> : <CircleDot className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setOpenId(t.id)} className="text-left font-semibold text-ink after:absolute after:inset-0">
                    {t.issueLabel}
                    <span className="ml-2 text-xs font-normal text-ink-muted">{t.ticketNo}</span>
                  </button>
                  <p className="truncate text-sm text-ink-muted">
                    {t.customerName}
                    {t.orderNo ? ` · ${t.orderNo}` : ""}
                    {t.message ? ` · ${t.message}` : ""}
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-xs text-ink-muted sm:flex">
                  {t.contactPref === "call" ? <Phone className="size-3.5" /> : <MessageCircle className="size-3.5" />}
                  {ago(t.createdAt)}
                </span>
                <Pill tone={TICKET_TONE[t.status]}>{TICKET_LABEL[t.status]}</Pill>
                <ChevronRight className="size-4 text-ink-muted" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {current && <TicketDetail t={current} run={run} pending={pending} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TicketDetail({ t, run, pending }: { t: AdminTicket; run: Run; pending: boolean }) {
  const set = (status: TicketStatus) => run(async () => unwrap(await setTicketStatusAction(t.id, status)), `${t.ticketNo} marked ${TICKET_LABEL[status].toLowerCase()}`);
  return (
    <>
      <SheetHeader className="border-b border-line">
        <div className="flex items-center gap-2">
          <SheetTitle>{t.issueLabel}</SheetTitle>
          <Pill tone={TICKET_TONE[t.status]}>{TICKET_LABEL[t.status]}</Pill>
        </div>
        <SheetDescription>
          {t.ticketNo} · {when(t.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-8">
        <section className="rounded-xl bg-subtle p-3.5 text-sm whitespace-pre-line text-ink">{t.message || <span className="text-ink-muted">No message, just the issue.</span>}</section>

        {t.photos.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {t.photos.map((p) => (
                <a key={p} href={p} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-line">
                  <Image src={p} alt="Customer photo" width={240} height={240} className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="divide-y divide-line rounded-xl border border-line px-3.5">
          <Field label="Customer">{t.customerName}</Field>
          <Field label="Phone">
            <span className="inline-flex items-center gap-1">
              {t.phone} <CopyButton value={t.phone} label="Copy phone" />
            </span>
          </Field>
          {t.email && <Field label="Email">{t.email}</Field>}
          <Field label="Wants">{t.contactPref === "call" ? `A call${t.callbackSlot ? ` (${t.callbackSlot})` : ""}` : "WhatsApp reply"}</Field>
          {t.utr && (
            <Field label="UTR / reference">
              <span className="inline-flex items-center gap-1 font-mono">
                {t.utr} <CopyButton value={t.utr} label="Copy UTR" />
              </span>
            </Field>
          )}
          {t.orderId && (
            <Field label="Order">
              <Link href={`/admin/orders/view?id=${t.orderId}`} className="text-forest-fg underline-offset-2 hover:underline">
                {t.orderNo ?? `#${t.orderId}`}
              </Link>
              {t.orderStatus && <span className="ml-1 text-ink-muted">({t.orderStatus.replace(/_/g, " ")})</span>}
            </Field>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <a href={wa(t.phone, `Namaste ${t.customerName}, this is Shree Mahadev Products about your help request ${t.ticketNo}.`)} target="_blank" rel="noreferrer" className={ghost}>
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a href={`tel:+91${t.phone}`} className={ghost}>
            <Phone className="size-4" /> Call
          </a>
        </div>

        <section className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Status</h3>
          <div className="flex flex-wrap gap-2">
            {t.status !== "in_progress" && t.status !== "resolved" && (
              <button type="button" disabled={pending} onClick={() => set("in_progress")} className={ghost}>
                <Clock className="size-4" /> Start working
              </button>
            )}
            {t.status !== "resolved" ? (
              <button type="button" disabled={pending} onClick={() => set("resolved")} className={primary}>
                <CheckCircle2 className="size-4" /> Mark resolved
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={() => set("open")} className={ghost}>
                <Undo2 className="size-4" /> Reopen
              </button>
            )}
            {pending && <Loader2 className="size-4 self-center animate-spin text-ink-muted" />}
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────── Back in stock ───────────── */

function WaitlistView({ groups, run, pending }: { groups: WaitlistGroup[]; run: Run; pending: boolean }) {
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = groups.filter((g) => !needle || `${g.productTitle} ${g.variant} ${g.phones.map((p) => p.phone).join(" ")}`.toLowerCase().includes(needle));
  const current = groups.find((g) => g.variantKey === openKey) ?? null;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <p className="text-sm text-ink-muted">Shoppers who tapped “Notify me” on a sold-out size. Restock it, then send the WhatsApp alert.</p>
        <SearchBox value={q} onChange={setQ} placeholder="Product or phone" />
      </div>
      <div className={card}>
        {shown.length === 0 ? (
          <Empty icon={BellRing} title="No one is waiting" hint="When a size is sold out, shoppers can ask to be told when it is back. They show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((g) => {
              const inStock = g.available && (g.stock === null || g.stock > 0);
              return (
                <li key={g.variantKey} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                  <Thumb src={g.image} alt={g.productTitle} />
                  <button type="button" onClick={() => setOpenKey(g.variantKey)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold text-ink">{g.productTitle}</p>
                    <p className="text-sm text-ink-muted">
                      {g.variant} · {inStock ? <span className="text-forest-fg">In stock{g.stock !== null ? ` (${g.stock})` : ""}</span> : <span className="text-sale">Sold out</span>}
                    </p>
                  </button>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-ink">{g.waiting}</p>
                    <p className="text-xs text-ink-muted">waiting{g.notified ? ` · ${g.notified} told` : ""}</p>
                  </div>
                  {g.waiting > 0 && (
                    <ConfirmAction
                      trigger={
                        <button type="button" disabled={pending} className={inStock ? primary : ghost}>
                          <BellRing className="size-4" /> Notify {g.waiting}
                        </button>
                      }
                      title={`Send the restock alert to ${g.waiting} shopper(s)?`}
                      description={
                        inStock
                          ? `A WhatsApp message goes out saying ${g.productTitle} (${g.variant}) is back.`
                          : `${g.productTitle} (${g.variant}) still shows as sold out. Restock it on the Inventory page first, or shoppers will land on a sold-out item.`
                      }
                      confirmLabel="Send alert"
                      onConfirm={() => run(async () => unwrap(await notifyWaitlistAction(g.variantKey)), `Restock alert queued for ${g.productTitle} (${g.variant})`)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet open={!!current} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {current && (
            <>
              <SheetHeader className="border-b border-line">
                <SheetTitle>{current.productTitle}</SheetTitle>
                <SheetDescription>
                  {current.variant} · {current.waiting} waiting since {when(current.oldest)}
                </SheetDescription>
              </SheetHeader>
              <ul className="divide-y divide-line px-4 pb-8">
                {current.phones.map((p) => (
                  <li key={p.phone} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium tabular-nums text-ink">{p.phone}</span>
                    <span className="flex items-center gap-2 text-ink-muted">
                      {ago(p.at)}
                      <CopyButton value={p.phone} label="Copy phone" />
                    </span>
                  </li>
                ))}
                {!current.phones.length && <li className="py-4 text-sm text-ink-muted">Everyone has been told already.</li>}
              </ul>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ───────────── FAQ feedback ───────────── */

function FaqView({ faqs }: { faqs: Faq[] }) {
  const sorted = useMemo(() => [...faqs].sort((a, b) => b.notHelpful - a.notHelpful || b.helpful + b.notHelpful - (a.helpful + a.notHelpful)), [faqs]);
  const worst = sorted.find((f) => f.notHelpful > f.helpful);
  if (!faqs.length) return <div className={card}><Empty icon={HelpCircle} title="No votes yet" hint="Shoppers can mark each FAQ answer helpful or not on the Help page. Results show here." /></div>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        {worst ? (
          <>
            <span className="font-semibold text-ink">“{worst.question}”</span> gets more 👎 than 👍. Its answer may need a rewrite.
          </>
        ) : (
          "Every answer gets more helpful votes than not. Nice."
        )}
      </p>
      <div className={card}>
        <ul className="divide-y divide-line">
          {sorted.map((f) => {
            const total = f.helpful + f.notHelpful;
            const pct = total ? Math.round((f.helpful / total) * 100) : 0;
            return (
              <li key={f.faqId} className="px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-ink">{f.question}</p>
                  <span className="flex shrink-0 items-center gap-3 text-sm tabular-nums">
                    <span className="inline-flex items-center gap-1 text-forest-fg"><ThumbsUp className="size-3.5" /> {f.helpful}</span>
                    <span className="inline-flex items-center gap-1 text-sale"><ThumbsDown className="size-3.5" /> {f.notHelpful}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-warm" aria-label={`${pct}% helpful`}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-forest" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
