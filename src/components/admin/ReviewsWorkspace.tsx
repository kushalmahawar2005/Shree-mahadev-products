"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, BadgeCheck, Check, Clock, EyeOff, Loader2, MessageSquareReply, Plus, Search, Sparkles, Star } from "lucide-react";
import { featureReviewAction, importGoogleReviewAction, moderateReviewAction, updateReviewReplyAction } from "@/lib/review-actions";
import type { PublicReview } from "@/lib/server/reviews";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Switch } from "@/components/shadcn/switch";
import { StatTile } from "@/components/admin/ui";
import { cn } from "@/lib/utils/cn";

type Product = { handle: string; title: string };
type Tab = "pending" | "approved" | "rejected";
type Run = (action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Published" },
  { id: "rejected", label: "Hidden" },
];
const date = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(d).slice(0, 10) + "T00:00:00+05:30"));

export function ReviewsWorkspace({
  pending,
  approved,
  rejected,
  products,
}: {
  pending: PublicReview[];
  approved: PublicReview[];
  rejected: PublicReview[];
  products: Product[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(pending.length ? "pending" : "approved");
  const [stars, setStars] = useState(0);
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, start] = useTransition();
  const lists = { pending, approved, rejected };

  const run: Run = (action, after) => {
    setNotice("");
    start(async () => {
      const res = await action();
      if (!res.ok) return setNotice(res.error ?? "Could not save this change.");
      after?.();
      router.refresh();
    });
  };

  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  const needle = q.trim().toLowerCase();
  const shown = lists[tab].filter(
    (r) => (!stars || r.rating === stars) && (!needle || `${r.name} ${r.productTitle} ${r.title} ${r.body}`.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Reviews</h1>
          <p className="mt-1 text-sm text-ink-muted">Check genuine buyer feedback before it shows on the store.</p>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid"
        >
          <Plus className="size-4" />
          Import Google review
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={Clock} label="Waiting for you" value={String(pending.length)} note="Pending approval" tone={pending.length ? "warn" : undefined} />
        <StatTile icon={Star} label="Average rating" value={avg ? `${avg.toFixed(1)} ★` : "-"} note={`${approved.length} published`} />
        <StatTile icon={BadgeCheck} label="Verified buyers" value={String(approved.filter((r) => r.verified).length)} note="Of published reviews" />
        <StatTile icon={Sparkles} label="Featured" value={String(approved.filter((r) => r.featured).length)} note="Highlighted on the store" />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex w-full rounded-full border border-line bg-surface p-1 sm:w-auto" role="tablist" aria-label="Review status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold sm:flex-none",
                tab === t.id ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg",
              )}
            >
              {t.label}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.id ? "bg-white/20" : "bg-khaki-soft")}>{lists[t.id].length}</span>
            </button>
          ))}
        </div>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5">
            {[0, 5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stars === s}
                onClick={() => setStars(s)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold",
                  stars === s ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:text-forest-fg",
                )}
              >
                {s ? (
                  <>
                    {s} <Star className="size-3 fill-current" />
                  </>
                ) : (
                  "All ratings"
                )}
              </button>
            ))}
          </div>
        </div>
        <label className="relative lg:ml-auto lg:w-64">
          <span className="sr-only">Search reviews</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, product or text" className={cn(input, "h-10 rounded-full pl-10")} />
        </label>
      </div>

      {notice && (
        <p role="alert" className="rounded-xl border border-warm-line bg-warm px-4 py-2.5 text-sm text-sale">
          {notice}
        </p>
      )}

      {!shown.length ? (
        <div className={cn(card, "px-6 py-12 text-center text-sm text-ink-muted")}>
          {lists[tab].length ? "No reviews match." : tab === "pending" ? "All caught up. No reviews waiting." : "Nothing here yet."}
        </div>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {shown.map((r) => (
            <ReviewCard key={r.id} review={r} status={tab} busy={busy} run={run} />
          ))}
        </ul>
      )}

      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto border-line bg-canvas p-0 sm:max-w-md">
          <SheetHeader className="border-b border-line bg-surface px-5 py-4">
            <SheetTitle className="text-lg font-bold text-forest-text">Import a Google review</SheetTitle>
            <SheetDescription className="text-xs text-ink-muted">Copy a real review from your Google Business profile. It goes to Pending first.</SheetDescription>
          </SheetHeader>
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () =>
                  importGoogleReviewAction({
                    productHandle: String(f.get("productHandle")),
                    name: String(f.get("name")),
                    city: String(f.get("city")),
                    rating: Number(f.get("rating")),
                    title: String(f.get("title")),
                    body: String(f.get("body")),
                    createdAt: String(f.get("createdAt")),
                  }),
                () => {
                  setImportOpen(false);
                  setTab("pending");
                },
              );
            }}
          >
            <Field label="Product">
              <select name="productHandle" required className={cn(input, "h-10")}>
                <option value="">Choose product</option>
                {products.map((p) => (
                  <option key={p.handle} value={p.handle}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reviewer name">
                <input name="name" required maxLength={120} className={cn(input, "h-10")} />
              </Field>
              <Field label="City">
                <input name="city" maxLength={80} className={cn(input, "h-10")} />
              </Field>
              <Field label="Rating">
                <select name="rating" defaultValue="5" className={cn(input, "h-10")}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Review date">
                <input name="createdAt" type="date" required className={cn(input, "h-10")} />
              </Field>
            </div>
            <Field label="Title (optional)">
              <input name="title" maxLength={160} className={cn(input, "h-10")} />
            </Field>
            <Field label="Review text">
              <textarea name="body" required minLength={10} maxLength={3000} rows={5} className={cn(input, "py-2.5")} />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-forest text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Import review
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReviewCard({ review: r, status, busy, run }: { review: PublicReview; status: Tab; busy: boolean; run: Run }) {
  const [reply, setReply] = useState(r.reply);
  const [replying, setReplying] = useState(false);
  const initials = r.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <li className={cn(card, "flex flex-col p-4 sm:p-5")}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-khaki-soft text-xs font-bold text-forest-fg">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-semibold text-ink">{r.name}</p>
            {r.verified ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest-fg">
                <BadgeCheck className="size-3.5" /> Verified buyer
              </span>
            ) : r.source === "google" ? (
              <span className="text-[11px] font-semibold text-ink-muted">Google review</span>
            ) : null}
          </div>
          <p className="truncate text-xs text-ink-muted">
            {r.city && `${r.city} · `}
            {date(r.createdAt)}
          </p>
        </div>
        <span className="flex shrink-0" aria-label={`${r.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-4", n <= r.rating ? "fill-mustard text-mustard" : "text-line")} />
          ))}
        </span>
      </div>

      <p className="mt-3 inline-flex w-fit max-w-full truncate rounded-full bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">{r.productTitle}</p>
      {r.title && <p className="mt-2 font-semibold text-forest-text">{r.title}</p>}
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink">{r.body}</p>

      {r.holdReason && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-warm-line bg-warm px-3 py-2 text-xs text-sale">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          Auto-held: {r.holdReason}
        </p>
      )}

      {r.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.photos.map((p) => (
            <a key={p.publicId} href={p.url} target="_blank" rel="noreferrer" className="relative size-16 overflow-hidden rounded-xl border border-line">
              <Image src={p.url} alt={`Photo attached to ${r.name}'s review`} fill sizes="64px" className="object-cover" />
            </a>
          ))}
        </div>
      )}

      {status === "approved" && r.reply && !replying && (
        <div className="mt-3 rounded-xl bg-subtle px-3.5 py-2.5 text-sm">
          <p className="text-[11px] font-semibold text-forest-fg">Your reply</p>
          <p className="mt-0.5 text-ink">{r.reply}</p>
        </div>
      )}
      {status === "approved" && replying && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateReviewReplyAction({ id: r.id, reply }), () => setReplying(false));
          }}
        >
          <label className="sr-only" htmlFor={`reply-${r.id}`}>
            Public reply
          </label>
          <textarea
            id={`reply-${r.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={2000}
            rows={3}
            autoFocus
            placeholder="Thank them, or answer their question. Shown under the review."
            className={cn(input, "py-2.5")}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => (setReply(r.reply), setReplying(false))} className={cn(btn, "text-ink-muted hover:bg-khaki-soft")}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}>
              Save reply
            </button>
          </div>
        </form>
      )}

      <div className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {status === "pending" && (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => moderateReviewAction({ id: r.id, action: "approve" }))} className={cn(btn, "bg-forest text-white hover:bg-forest-mid")}>
              <Check className="size-4" /> Publish
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => moderateReviewAction({ id: r.id, action: "hide" }))} className={cn(btn, "border border-line text-ink-muted hover:bg-khaki-soft")}>
              <EyeOff className="size-4" /> Hide
            </button>
          </>
        )}
        {status === "approved" && (
          <>
            {!replying && (
              <button type="button" onClick={() => setReplying(true)} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
                <MessageSquareReply className="size-4" /> {r.reply ? "Edit reply" : "Reply"}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => run(() => moderateReviewAction({ id: r.id, action: "hide" }))} className={cn(btn, "text-ink-muted hover:bg-khaki-soft")}>
              <EyeOff className="size-4" /> Hide
            </button>
            <label className="ml-auto flex items-center gap-2 text-sm font-medium text-ink-muted">
              Feature
              <Switch
                checked={r.featured}
                disabled={busy}
                onCheckedChange={(on) => run(() => featureReviewAction({ id: r.id, featured: on }))}
                className="data-[state=checked]:bg-forest"
              />
            </label>
          </>
        )}
        {status === "rejected" && (
          <button type="button" disabled={busy} onClick={() => run(() => moderateReviewAction({ id: r.id, action: "approve" }))} className={cn(btn, "border border-line text-forest-fg hover:bg-khaki-soft")}>
            <Check className="size-4" /> Publish instead
          </button>
        )}
      </div>
    </li>
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
