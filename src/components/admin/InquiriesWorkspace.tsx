"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDownUp,
  Building2,
  ChevronDown,
  Filter,
  CalendarClock,
  Clock,
  IndianRupee,
  Inbox,
  KanbanSquare,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Rows3,
  Search,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { INDIAN_STATES } from "@/lib/checkout";
import {
  addInquiryNoteAction,
  createManualInquiryOrderAction,
  updateInquiryDetailsAction,
  updateInquiryStatusAction,
} from "@/lib/inquiry-actions";
import { INQUIRY_STATUSES, type Inquiry, type InquiryStatus } from "@/lib/inquiry-types";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { StatTile, StatusBadge, inputCls } from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/order/CopyButton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

type VariantChoice = { variantKey: string; title: string; price: number };
const STAGE: Record<InquiryStatus, { label: string; tone: "gray" | "amber" | "green" | "red"; dot: string }> = {
  new: { label: "New", tone: "amber", dot: "bg-amber-500" },
  contacted: { label: "Contacted", tone: "gray", dot: "bg-sky-500" },
  quoted: { label: "Quote sent", tone: "amber", dot: "bg-violet-500" },
  won: { label: "Won", tone: "green", dot: "bg-emerald-500" },
  lost: { label: "Lost", tone: "red", dot: "bg-red-500" },
};

/** "2026-11-19 19:29:00" (IST from the DB) → "19 Nov, 7:29 pm". */
function when(s: string) {
  const d = new Date(`${s.replace(" ", "T").slice(0, 19)}+05:30`);
  if (Number.isNaN(d.getTime())) return s.slice(0, 16);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
}
/** "Groundnut Oil, Sunflower Oil" → ["Groundnut Oil", "Sunflower Oil"]. */
const products = (s: string) => s.split(",").map((p) => p.trim()).filter(Boolean);
/** The bulk form saves "Looking for: Retail bottles, Tins" as the first line of the message. */
const needsOf = (message: string) => {
  const m = /^Looking for:\s*(.+)$/m.exec(message);
  return m ? m[1]!.split(",").map((x) => x.trim()).filter(Boolean) : [];
};
/** YYYY-MM-DD `n` days before `day` (both IST calendar dates). */
/** The buyer's own words, without the "Looking for:" line the form adds. */
const noteOf = (message: string) => message.replace(/^Looking for:.*(\n+|$)/m, "").trim();
const daysBefore = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
const RANGES = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
] as const;
type RangeId = (typeof RANGES)[number]["id"];
const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "quote", label: "Highest quote" },
  { id: "followup", label: "Follow-up soonest" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

export function InquiriesWorkspace({
  initialInquiries,
  variants,
  initialFilter,
  today,
}: {
  initialInquiries: Inquiry[];
  variants: VariantChoice[];
  initialFilter: "all" | "due";
  today: string;
}) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [mode, setMode] = useState<"board" | "table">("board");
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [range, setRange] = useState<RangeId>("all");
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [needFilter, setNeedFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortId>("newest");
  const [pending, startTransition] = useTransition();

  // Filter choices come from the leads themselves, so they always match what was asked for.
  const productChoices = useMemo(() => [...new Set(inquiries.flatMap((i) => products(i.product)))].sort(), [inquiries]);
  const needChoices = useMemo(() => [...new Set(inquiries.flatMap((i) => needsOf(i.message)))].sort(), [inquiries]);
  const since =
    range === "today" ? today : range === "7d" ? daysBefore(today, 6) : range === "30d" ? daysBefore(today, 29) : range === "month" ? `${today.slice(0, 8)}01` : "";
  const filtersOn = Boolean(since || productFilter.length || needFilter.length);
  const clearFilters = () => {
    setRange("all");
    setProductFilter([]);
    setNeedFilter([]);
  };

  const isDue = (i: Inquiry) => Boolean(i.followUpAt && i.followUpAt <= today && i.status !== "won" && i.status !== "lost");
  const visible = useMemo(
    () =>
      inquiries.filter((inquiry) => {
        const matchesQuery = `${inquiry.name} ${inquiry.business} ${inquiry.city} ${inquiry.phone} ${inquiry.product}`
          .toLowerCase()
          .includes(query.toLowerCase());
        if (!matchesQuery || (filter === "due" && !isDue(inquiry))) return false;
        if (since && inquiry.createdAt.slice(0, 10) < since) return false;
        if (productFilter.length && !products(inquiry.product).some((p) => productFilter.includes(p))) return false;
        if (needFilter.length && !needsOf(inquiry.message).some((n) => needFilter.includes(n))) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "quote") return (b.quoteAmount ?? -1) - (a.quoteAmount ?? -1);
        if (sort === "followup") return (a.followUpAt || "9999").localeCompare(b.followUpAt || "9999");
        return b.createdAt.localeCompare(a.createdAt);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDue only reads `today`
    [inquiries, query, filter, today, since, productFilter, needFilter, sort],
  );
  const stats = useMemo(() => {
    const open = inquiries.filter((i) => i.status !== "won" && i.status !== "lost");
    return {
      total: inquiries.length,
      fresh: inquiries.filter((i) => i.status === "new").length,
      due: inquiries.filter(isDue).length,
      won: inquiries.filter((i) => i.status === "won").length,
      pipeline: open.reduce((n, i) => n + (i.quoteAmount ?? 0), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDue only reads `today`
  }, [inquiries, today]);
  const active = inquiries.find((i) => i.id === openId) ?? null;

  function patch(id: number, changes: Partial<Inquiry>) {
    setInquiries((rows) => rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  }

  function move(id: number, status: InquiryStatus) {
    const previous = inquiries;
    patch(id, { status });
    setNotice("");
    startTransition(async () => {
      const result = await updateInquiryStatusAction({ id, status });
      if (!result.ok) {
        setInquiries(previous);
        setNotice(result.error ?? "Could not update inquiry.");
      }
    });
  }

  const seg = (on: boolean) =>
    cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors", on ? "bg-forest text-white shadow-sm" : "text-ink-muted hover:text-forest-fg");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Inbox} label="All leads" value={String(stats.total)} note={`${stats.fresh} new`} />
        <StatTile icon={CalendarClock} label="Follow-ups due" value={String(stats.due)} note="today or overdue" tone={stats.due ? "warn" : undefined} />
        <StatTile icon={Trophy} label="Won" value={String(stats.won)} note={stats.total ? `${Math.round((stats.won / stats.total) * 100)}% of leads` : undefined} />
        <StatTile icon={IndianRupee} label="Open quotes" value={formatMoney(stats.pipeline)} note="quoted, not closed yet" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)] lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search inquiries</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, business, phone or product"
            className="h-11 w-full rounded-xl border border-line bg-subtle pr-10 pl-10 text-sm outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/10"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Which leads" className="flex rounded-full border border-line bg-subtle p-1">
            <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={seg(filter === "all")}>
              All leads
            </button>
            <button type="button" onClick={() => setFilter("due")} aria-pressed={filter === "due"} className={seg(filter === "due")}>
              Follow-ups due
              {stats.due > 0 && <span className={cn("rounded-full px-1.5 text-[11px]", filter === "due" ? "bg-white/20" : "bg-warm text-ink")}>{stats.due}</span>}
            </button>
          </div>
          <div role="group" aria-label="Layout" className="flex rounded-full border border-line bg-subtle p-1">
            <button type="button" onClick={() => setMode("board")} aria-pressed={mode === "board"} className={seg(mode === "board")}>
              <KanbanSquare className="size-4" /> Board
            </button>
            <button type="button" onClick={() => setMode("table")} aria-pressed={mode === "table"} className={seg(mode === "table")}>
              <Rows3 className="size-4" /> Table
            </button>
          </div>
          {(pending || notice) && (
            <span aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs", notice ? "text-sale" : "text-ink-muted")}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              {notice || "Saving…"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Received" className="no-scrollbar flex max-w-full overflow-x-auto rounded-full border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <button key={r.id} type="button" onClick={() => setRange(r.id)} aria-pressed={range === r.id} className={cn(seg(range === r.id), "h-8 shrink-0 px-3 text-xs")}>
              {r.label}
            </button>
          ))}
        </div>
        <MultiFilter label="Products" choices={productChoices} value={productFilter} onChange={setProductFilter} />
        {needChoices.length > 0 && <MultiFilter label="Looking for" choices={needChoices} value={needFilter} onChange={setNeedFilter} />}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:border-forest/50">
            <ArrowDownUp className="size-4 text-ink-muted" />
            {SORTS.find((x) => x.id === sort)?.label}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-xs text-ink-muted">Sort leads</DropdownMenuLabel>
            {SORTS.map((x) => (
              <DropdownMenuItem key={x.id} onSelect={() => setSort(x.id)} className="h-9 justify-between">
                {x.label}
                {sort === x.id && <span className="size-1.5 rounded-full bg-forest" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filtersOn && (
          <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-muted hover:bg-khaki-soft">
            <X className="size-3.5" /> Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-ink-muted">
          {visible.length} of {inquiries.length} lead{inquiries.length === 1 ? "" : "s"}
        </span>
      </div>

      {mode === "board" ? (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 xl:grid xl:grid-cols-5 xl:overflow-visible">
          {INQUIRY_STATUSES.map((status) => {
            const rows = visible.filter((inquiry) => inquiry.status === status);
            return (
              <section
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  if (id) move(id, status);
                }}
                className="w-[280px] shrink-0 snap-start rounded-2xl border border-line bg-subtle/70 p-2.5 xl:w-auto"
              >
                <header className="mb-2.5 flex items-center justify-between gap-2 px-1.5 pt-1">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-forest-text">
                    <span className={cn("size-2 rounded-full", STAGE[status].dot)} />
                    {STAGE[status].label}
                  </h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-muted tabular-nums ring-1 ring-line">{rows.length}</span>
                </header>
                <div className="space-y-2.5">
                  {rows.map((inquiry) => (
                    <InquiryCard key={inquiry.id} inquiry={inquiry} due={isDue(inquiry)} onOpen={() => setOpenId(inquiry.id)} />
                  ))}
                  {!rows.length && <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-muted">Drag a lead here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-line bg-subtle text-xs text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Quote</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((inquiry) => (
                  <tr key={inquiry.id} onClick={() => setOpenId(inquiry.id)} className="cursor-pointer hover:bg-subtle">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left font-semibold text-forest-text hover:underline">
                        {inquiry.name}
                      </button>
                      <span className="block text-xs text-ink-muted">{[inquiry.business, inquiry.city].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <span className="line-clamp-1">{inquiry.product}</span>
                      <span className="block text-xs text-ink-muted">{inquiry.quantity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={STAGE[inquiry.status].tone}>{STAGE[inquiry.status].label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{inquiry.quoteAmount !== null ? formatMoney(inquiry.quoteAmount) : "—"}</td>
                    <td className={cn("px-4 py-3 whitespace-nowrap", isDue(inquiry) && "font-semibold text-sale")}>{inquiry.followUpAt || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{when(inquiry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!visible.length && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">
          {query || filtersOn ? "No leads match these filters." : filter === "due" ? "No follow-ups due. You're all caught up." : "No bulk inquiries yet."}
        </p>
      )}
      <p className="text-xs text-ink-muted">Showing up to 500 recent bulk inquiries. Click a lead to see everything; drag cards between stages to move them.</p>

      <Sheet open={Boolean(active)} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          {active && <LeadSheet key={active.id} inquiry={active} variants={variants} due={isDue(active)} onMove={move} onPatch={(c) => patch(active.id, c)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Pill that opens a checkbox list (Products / Looking for). Shows "Products · 2" when some are picked. */
function MultiFilter({ label, choices, value, onChange }: { label: string; choices: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!choices.length}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border bg-surface px-4 text-xs font-semibold hover:border-forest/50 disabled:opacity-50",
          value.length ? "border-forest text-forest-fg" : "border-line text-ink",
        )}
      >
        <Filter className="size-3.5 text-ink-muted" />
        {label}
        {value.length > 0 && <span className="rounded-full bg-forest px-1.5 text-[10px] text-white">{value.length}</span>}
        <ChevronDown className="size-3.5 text-ink-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-ink-muted">{label}</DropdownMenuLabel>
        {choices.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={value.includes(c)}
            onCheckedChange={(on) => onChange(on ? [...value, c] : value.filter((x) => x !== c))}
            onSelect={(e) => e.preventDefault()}
            className="h-9"
          >
            {c}
          </DropdownMenuCheckboxItem>
        ))}
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])} className="h-9 text-ink-muted">
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InquiryCard({ inquiry, due, onOpen }: { inquiry: Inquiry; due: boolean; onOpen: () => void }) {
  const items = products(inquiry.product);
  const needs = needsOf(inquiry.message);
  const note = noteOf(inquiry.message);
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(inquiry.id))}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      tabIndex={0}
      role="button"
      aria-label={`Open lead ${inquiry.name}`}
      className="group cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-forest/30 focus-visible:outline-none"
    >
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-khaki-soft text-sm font-bold text-forest-fg">
          {inquiry.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-forest-text">{inquiry.name}</h3>
          <p className="truncate text-xs text-ink-muted">{[inquiry.business, inquiry.city].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {items.slice(0, 3).map((p) => (
          <span key={p} className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink ring-1 ring-line">
            {p}
          </span>
        ))}
        {items.length > 3 && <span className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-muted">+{items.length - 3}</span>}
      </div>
      {inquiry.quantity && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
          <Package className="size-3.5" /> {inquiry.quantity}
        </p>
      )}
      {needs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {needs.map((n) => (
            <span key={n} className="rounded-full bg-khaki-soft px-2 py-0.5 text-[10.5px] font-semibold text-forest-fg">
              {n}
            </span>
          ))}
        </div>
      )}
      {note && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">“{note}”</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <Clock className="size-3" /> {when(inquiry.createdAt)}
        </span>
        {inquiry.quoteAmount !== null && <span className="ml-auto rounded-full bg-khaki-soft px-2 py-0.5 font-semibold text-forest-fg">{formatMoney(inquiry.quoteAmount)}</span>}
        {inquiry.followUpAt && (
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", due ? "bg-warm text-ink" : "bg-subtle text-ink-muted", inquiry.quoteAmount === null && "ml-auto")}>
            {due ? "Due " : "Follow-up "}
            {inquiry.followUpAt.slice(5)}
          </span>
        )}
        {inquiry.notes.length > 0 && <span className="text-ink-muted">· {inquiry.notes.length} note{inquiry.notes.length === 1 ? "" : "s"}</span>}
      </div>
    </article>
  );
}

function LeadSheet({
  inquiry,
  variants,
  due,
  onMove,
  onPatch,
}: {
  inquiry: Inquiry;
  variants: VariantChoice[];
  due: boolean;
  onMove: (id: number, status: InquiryStatus) => void;
  onPatch: (changes: Partial<Inquiry>) => void;
}) {
  const [assignee, setAssignee] = useState(inquiry.assignee);
  const [followUpAt, setFollowUpAt] = useState(inquiry.followUpAt);
  const [quoteAmount, setQuoteAmount] = useState(inquiry.quoteAmount === null ? "" : String(inquiry.quoteAmount));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const dirty = assignee !== inquiry.assignee || followUpAt !== inquiry.followUpAt || quoteAmount !== (inquiry.quoteAmount === null ? "" : String(inquiry.quoteAmount));

  function saveDetails() {
    startTransition(async () => {
      const quote = quoteAmount === "" ? null : Number(quoteAmount);
      const result = await updateInquiryDetailsAction({ id: inquiry.id, assignee, followUpAt, quoteAmount: quote });
      if (result.ok) onPatch({ assignee, followUpAt, quoteAmount: quote });
      setMessage(result.ok ? "Saved." : (result.error ?? "Could not save."));
    });
  }

  function saveNote() {
    const body = note.trim();
    startTransition(async () => {
      const result = await addInquiryNoteAction({ id: inquiry.id, body });
      if (result.ok) {
        setNote("");
        const now = new Date(Date.now() + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 19);
        onPatch({ notes: [...inquiry.notes, { id: -Date.now(), author: "You", body, createdAt: now }] });
      }
      setMessage(result.ok ? "Note added." : (result.error ?? "Could not save note."));
    });
  }

  const label = "text-[11px] font-semibold tracking-wide text-ink-muted uppercase";
  return (
    <>
      <SheetHeader className="gap-3 border-b border-line bg-subtle p-5">
        <div className="flex items-start gap-3 pr-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-forest text-lg font-bold text-white">
            {inquiry.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg">{inquiry.name}</SheetTitle>
            <SheetDescription className="truncate">{[inquiry.business, inquiry.city].filter(Boolean).join(" · ") || "Bulk inquiry"}</SheetDescription>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={STAGE[inquiry.status].tone}>{STAGE[inquiry.status].label}</StatusBadge>
              {due && <span className="rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-ink">Follow-up due</span>}
              <span className="text-xs text-ink-muted">Received {when(inquiry.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:+91${inquiry.phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-white hover:bg-forest-deep">
            <Phone className="size-4" /> Call
          </a>
          <a href={`https://wa.me/91${inquiry.phone}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-forest-fg hover:border-forest/40">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        </div>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <section>
          <p className={label}>Stage</p>
          <div className="mt-2 grid grid-cols-5 gap-1 rounded-xl border border-line bg-subtle p-1">
            {INQUIRY_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => s !== inquiry.status && onMove(inquiry.id, s)}
                aria-pressed={inquiry.status === s}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors",
                  inquiry.status === s ? "bg-surface text-forest-text shadow-sm ring-1 ring-line" : "text-ink-muted hover:text-forest-fg",
                )}
              >
                <span className={cn("size-1.5 rounded-full", STAGE[s].dot)} />
                <span className="truncate">{STAGE[s].label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line">
          <dl className="divide-y divide-line text-sm">
            <Row icon={Phone} k="Phone">
              <span className="inline-flex items-center gap-1 tabular-nums">
                {inquiry.phone} <CopyButton value={inquiry.phone} label="Copy phone" />
              </span>
            </Row>
            {inquiry.email && (
              <Row icon={Mail} k="Email">
                <a href={`mailto:${inquiry.email}`} className="break-all text-forest-fg hover:underline">
                  {inquiry.email}
                </a>
              </Row>
            )}
            {inquiry.business && <Row icon={Building2} k="Business">{inquiry.business}</Row>}
            {inquiry.city && <Row icon={MapPin} k="City">{inquiry.city}</Row>}
            <Row icon={Package} k="Products">
              <span className="flex flex-wrap gap-1">
                {products(inquiry.product).map((p) => (
                  <span key={p} className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium ring-1 ring-line">
                    {p}
                  </span>
                ))}
              </span>
            </Row>
            {inquiry.quantity && <Row icon={Package} k="Quantity">{inquiry.quantity}</Row>}
            {needsOf(inquiry.message).length > 0 && (
              <Row icon={Filter} k="Looking for">
                <span className="flex flex-wrap gap-1">
                  {needsOf(inquiry.message).map((n) => (
                    <span key={n} className="rounded-full bg-khaki-soft px-2 py-0.5 text-xs font-semibold text-forest-fg">
                      {n}
                    </span>
                  ))}
                </span>
              </Row>
            )}
          </dl>
        </section>

        {noteOf(inquiry.message) && (
          <section>
            <p className={label}>Their message</p>
            <p className="mt-2 rounded-2xl bg-khaki-soft p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink">{noteOf(inquiry.message)}</p>
          </section>
        )}

        <section>
          <p className={label}>Lead details</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-ink">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <UserRound className="size-3.5" /> Assignee
              </span>
              <input value={assignee} onChange={(event) => setAssignee(event.target.value)} maxLength={60} placeholder="Team member" className={`${inputCls} mt-1`} />
            </label>
            <label className="text-sm font-medium text-ink">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <CalendarClock className="size-3.5" /> Follow-up
              </span>
              <input type="date" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-sm font-medium text-ink">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <IndianRupee className="size-3.5" /> Quote amount
              </span>
              <input type="number" min="0" max="100000000" step="1" value={quoteAmount} onChange={(event) => setQuoteAmount(event.target.value)} placeholder="Optional" className={`${inputCls} mt-1`} />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={pending || !dirty} onClick={saveDetails} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-deep disabled:opacity-50">
              {pending && <Loader2 className="size-4 animate-spin" />} Save details
            </button>
            {message && (
              <span aria-live="polite" className="text-xs text-ink-muted">
                {message}
              </span>
            )}
          </div>
        </section>

        <section>
          <p className={label}>Notes</p>
          {inquiry.notes.length ? (
            <ol className="relative mt-3 space-y-3 border-l border-line pl-4">
              {[...inquiry.notes].reverse().map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-surface bg-forest" />
                  <p className="text-sm whitespace-pre-wrap text-ink">{item.body}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {item.author} · {when(item.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">No notes yet. Log calls and next steps here.</p>
          )}
          <div className="mt-3 rounded-2xl border border-line bg-subtle p-2 focus-within:border-forest">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Add a call note or next step"
              className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
            />
            <div className="flex justify-end">
              <button type="button" disabled={pending || !note.trim()} onClick={saveNote} className="h-8 rounded-full bg-forest px-4 text-xs font-semibold text-white disabled:opacity-40">
                Add note
              </button>
            </div>
          </div>
        </section>

        {inquiry.status === "won" && <ManualOrderForm inquiry={inquiry} variants={variants} />}
      </div>
    </>
  );
}

function Row({ icon: Icon, k, children }: { icon: React.ComponentType<{ className?: string }>; k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      <dt className="w-20 shrink-0 text-ink-muted">{k}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}

function ManualOrderForm({
  inquiry,
  variants,
}: {
  inquiry: Inquiry;
  variants: VariantChoice[];
}) {
  const first = variants[0];
  const [items, setItems] = useState([
    {
      variantKey: first?.variantKey ?? "",
      quantity: 1,
      unitPrice: first?.price ?? 1,
    },
  ]);
  const [method, setMethod] = useState<"cod" | "offline">("cod");
  const [shipping, setShipping] = useState("0");
  const [name, setName] = useState(inquiry.name);
  const [phone, setPhone] = useState(inquiry.phone);
  const [email, setEmail] = useState(inquiry.email);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(inquiry.city);
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createManualInquiryOrderAction({
        inquiryId: inquiry.id,
        name,
        phone,
        email,
        line1,
        line2,
        city,
        state,
        pincode,
        method,
        shipping: Number(shipping),
        items,
      });
      setMessage(
        result.ok
          ? `Created order ${result.orderNo}. Open it in Orders to review the address and shipping.`
          : (result.error ?? "Could not create the order."),
      );
    });
  }

  if (!variants.length)
    return (
      <p className="text-sm text-sale">
        No in-stock products are available to add to this order.
      </p>
    );
  return (
    <details className="rounded-2xl border border-forest/20 p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest-fg">
        Create manual order
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink-muted">
          Prices below are custom per-unit prices. Stock is reserved when you
          create the order.
        </p>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto]"
            >
              <select
                aria-label={`Product line ${index + 1}`}
                value={item.variantKey}
                onChange={(event) => {
                  const variant = variants.find(
                    (choice) => choice.variantKey === event.target.value,
                  );
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? {
                            ...line,
                            variantKey: event.target.value,
                            unitPrice: variant?.price ?? line.unitPrice,
                          }
                        : line,
                    ),
                  );
                }}
                className="min-h-11 min-w-0 rounded-xl border border-line bg-surface px-3"
              >
                {variants.map((variant) => (
                  <option key={variant.variantKey} value={variant.variantKey}>
                    {variant.title}
                  </option>
                ))}
              </select>
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max="100"
                value={item.quantity}
                onChange={(event) =>
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? { ...line, quantity: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
                className="min-h-11 rounded-xl border border-line px-3"
              />
              <input
                aria-label="Custom unit price"
                type="number"
                min="1"
                step="1"
                value={item.unitPrice}
                onChange={(event) =>
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? { ...line, unitPrice: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
                className="min-h-11 rounded-xl border border-line px-3"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setItems((lines) => lines.filter((_, i) => i !== index))
                  }
                  className="min-h-11 rounded-full border border-line px-3 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (first && items.length < 20)
              setItems((lines) => [
                ...lines,
                {
                  variantKey: first.variantKey,
                  quantity: 1,
                  unitPrice: first.price,
                },
              ]);
          }}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
        >
          Add product
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Customer name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Address line 1
            <input
              value={line1}
              onChange={(event) => setLine1(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Address line 2
            <input
              value={line2}
              onChange={(event) => setLine2(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            State
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              className={`${inputCls} mt-1`}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            PIN code
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Shipping charged (₹)
            <input
              type="number"
              min="0"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Payment
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as "cod" | "offline")
              }
              className={`${inputCls} mt-1`}
            >
              <option value="cod">Cash on delivery</option>
              <option value="offline">Paid offline</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={create}
          className="min-h-11 w-full rounded-full bg-forest px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Creating order…" : "Create order and take stock"}
        </button>
        {message && (
          <p aria-live="polite" className="text-sm text-ink-muted">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
