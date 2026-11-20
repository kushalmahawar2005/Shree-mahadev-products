"use client";

import { unwrap } from "@/lib/action-result";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, Film, Home, Loader2, Package, RefreshCw, Trash2, X } from "lucide-react";
import { ReelLinkField, ReelLinkThumb } from "./ReelLinkField";
import { Switch } from "@/components/shadcn/switch";
import { ConfirmAction } from "../order/ConfirmAction";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import {
  addReelLinkAction,
  addReelsAction,
  deleteReelAction,
  replaceReelVideoAction,
  reorderReelsAction,
  setBrandFilmAction,
  updateReelAction,
} from "@/lib/media-actions";
import type { Reel, ReelPlacement } from "@/lib/server/videos";
import { DropZone } from "./DropZone";
import { uploadToCloudinary } from "./upload";
import { Sortable } from "./Sortable";
import { cn } from "@/lib/utils/cn";

const input = "min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:border-forest focus:outline-none";
const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";

/** Plain-language places a reel can show. `href` = a page to check it on the live site. */
export type PlaceInfo = { id: ReelPlacement; label: string; short: string; href: string; note: string };

function PlaceChips({ value, onChange, places, size = "md" }: { value: ReelPlacement[]; onChange: (v: ReelPlacement[]) => void; places: PlaceInfo[]; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {places.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-semibold transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
              on ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:border-forest/40 hover:text-forest-fg",
            )}
          >
            {on ? <Check className="size-3" /> : <span className="size-3 rounded-full border border-current opacity-60" />}
            {size === "sm" ? p.short : p.label}
          </button>
        );
      })}
    </div>
  );
}

export function ReelManager({
  initial,
  youtube,
  products,
  places,
}: {
  initial: Reel[];
  youtube: string;
  products: { handle: string; title: string }[];
  places: PlaceInfo[];
}) {
  const [reels, setReels] = useState(initial);
  const [film, setFilm] = useState(youtube);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<ReelPlacement[]>(["home"]);
  const [view, setView] = useState<ReelPlacement | "all">("all");

  const run = (fn: () => Promise<Reel[] | void>, okText?: string) =>
    start(async () => {
      setMsg(null);
      try {
        const next = await fn();
        if (next) setReels(next);
        if (okText) setMsg({ ok: true, text: okText });
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message || "Something went wrong" });
      }
    });

  const count = (p: ReelPlacement) => reels.filter((r) => r.active && r.placements.includes(p)).length;
  const shown = view === "all" ? reels : reels.filter((r) => r.placements.includes(view));
  const targetLabel = places.filter((p) => target.includes(p.id)).map((p) => p.short).join(", ");

  return (
    <div className="space-y-8">
      {/* Where reels show: one card per place, with live count and a link to check it on the site */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Where reels show">
        {places.map((p) => {
          const n = count(p.id);
          return (
            <div key={p.id} className={cn(card, "p-4")}>
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">{p.id === "home" ? <Home className="size-4" /> : p.id === "product" ? <Package className="size-4" /> : <Clapperboard className="size-4" />}</span>
                <a href={p.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-forest-fg hover:underline">
                  See on site <ExternalLink className="size-3" />
                </a>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{p.label}</p>
              <p className="text-2xl font-bold tabular-nums text-ink">{n}</p>
              <p className="text-xs text-ink-muted">{n ? `reel${n === 1 ? "" : "s"} showing` : p.note}</p>
            </div>
          );
        })}
      </section>

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role={msg.ok ? "status" : "alert"}
            className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm", msg.ok ? "border-forest/20 bg-forest/10 text-forest-fg" : "border-warm-line bg-warm text-sale")}
          >
            {msg.ok ? <Check className="size-4" /> : <X className="size-4" />} {msg.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Add */}
      <section className={cn(card, "space-y-4 p-4 md:p-5")}>
        <div>
          <h2 className="flex items-center gap-3 font-bold text-forest-text">
            <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
              <Clapperboard className="size-4" />
            </span>
            Add reels
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Upload a video (it is compressed automatically) or paste a YouTube Shorts link. First choose where it should show.</p>
        </div>
        <div className="space-y-2 rounded-xl bg-subtle p-3">
          <p className="text-xs font-semibold text-ink">1. Show new reels on</p>
          <PlaceChips value={target} onChange={setTarget} places={places} />
          {!target.length && <p className="text-xs text-sale">Pick at least one place.</p>}
        </div>
        <p className="text-xs font-semibold text-ink">2. Add the video</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <DropZone
            folder="reels"
            label="Drop reel videos here, or click to choose"
            hint="MP4 / MOV, up to 100 MB each. Compressed automatically."
            onUploaded={(ups) =>
              target.length
                ? run(async () => unwrap(await addReelsAction(ups, target)), `${ups.length} reel(s) added to ${targetLabel}`)
                : setMsg({ ok: false, text: "Pick where the reel should show first." })
            }
          />
          <ReelLinkField
            disabled={pending || !target.length}
            hint="YouTube Shorts or any YouTube video. It plays right on the site."
            onAdd={(url) => run(async () => unwrap(await addReelLinkAction(url, target)), `YouTube reel added to ${targetLabel}`)}
          />
        </div>
      </section>

      {/* List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-forest-text">Your reels</h2>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <div className="flex w-max rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Filter reels by place">
              {[{ id: "all" as const, short: "All", n: reels.length }, ...places.map((p) => ({ id: p.id, short: p.short, n: reels.filter((r) => r.placements.includes(p.id)).length }))].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={view === t.id}
                  onClick={() => setView(t.id)}
                  className={cn("relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", view === t.id ? "text-white" : "text-ink-muted hover:text-forest-fg")}
                >
                  {view === t.id && <motion.span layoutId="reel-view" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                  <span className="relative">{t.short}</span>
                  <span className={cn("relative rounded-full px-1.5 tabular-nums", view === t.id ? "bg-white/20" : "bg-khaki-soft")}>{t.n}</span>
                </button>
              ))}
            </div>
          </div>
          {pending && <Loader2 className="size-4 animate-spin text-ink-muted" />}
        </div>

        {shown.length === 0 ? (
          <p className={cn(card, "p-6 text-center text-sm text-ink-muted")}>
            {reels.length ? "No reels here yet. Tick this place on a reel below, or add a new one." : "No reels yet. Until you add some, the site shows our built-in ghani clips."}
          </p>
        ) : (
          <>
            {view === "all" && <p className="text-sm text-ink-muted">Drag or use the arrows to change the order.</p>}
            <Sortable
              items={shown}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              onReorder={(next) => {
                if (view !== "all") return;
                setReels(next);
                run(async () => unwrap(await reorderReelsAction(next.map((r) => r.id))));
              }}
              render={(r, i, move) => (
                <div className={cn(card, "overflow-hidden", !r.active && "opacity-60")}>
                  <div className="relative">
                  <ReplaceVideo
                    disabled={pending}
                    onUploaded={(up) => run(async () => unwrap(await replaceReelVideoAction(r.id, up)), "Video replaced. Places, caption and product stay the same.")}
                    onError={(text) => setMsg({ ok: false, text })}
                  />
                  {!r.videoUrl ? (
                    <ReelLinkThumb link={r.instagramUrl ?? ""} className="w-full" />
                  ) : (
                    <video
                      src={cldVideo(r.videoUrl, 480)}
                      poster={cldVideoPoster(r.videoUrl, 360)}
                      muted
                      loop
                      playsInline
                      preload="none"
                      onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => e.currentTarget.pause()}
                      className="aspect-[9/16] w-full bg-black object-cover"
                    />
                  )}
                  </div>
                  <div className="space-y-2.5 p-2.5">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-ink-muted">Shows on</p>
                      <PlaceChips
                        size="sm"
                        places={places}
                        value={r.placements}
                        onChange={(placements) =>
                          placements.length
                            ? run(async () => unwrap(await updateReelAction(r.id, { placements })))
                            : setMsg({ ok: false, text: "A reel needs at least one place. To take it off the site, switch it to Hidden." })
                        }
                      />
                    </div>
                    <input
                      defaultValue={r.caption}
                      placeholder="Caption (optional)"
                      aria-label="Caption"
                      onBlur={(e) => e.target.value !== r.caption && run(async () => unwrap(await updateReelAction(r.id, { caption: e.target.value })))}
                      className={input}
                    />
                    {(r.placements.includes("home") || r.placements.includes("product")) && (
                      <label className="block text-[11px] font-semibold text-ink-muted">
                        {r.placements.includes("product") ? "Product (shows on its page + Add button)" : "Product button (home page)"}
                        <select
                          defaultValue={r.productHandle ?? ""}
                          onChange={(e) => run(async () => unwrap(await updateReelAction(r.id, { productHandle: e.target.value || null })))}
                          className={cn(input, "mt-1 font-normal")}
                        >
                          <option value="">No product</option>
                          {products.map((p) => (
                            <option key={p.handle} value={p.handle}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                        {r.placements.includes("product") && !r.productHandle && (
                          <span className="mt-1 block font-normal text-alert">Pick a product, or this reel shows nowhere for &ldquo;Product&rdquo;.</span>
                        )}
                      </label>
                    )}
                    <div className="flex items-center justify-between gap-1 border-t border-line pt-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                        <Switch checked={r.active} onCheckedChange={(on) => run(async () => unwrap(await updateReelAction(r.id, { active: on })))} className="data-[state=checked]:bg-forest" />
                        {r.active ? "Live" : "Hidden"}
                      </label>
                      <div className="flex">
                        {view === "all" && (
                          <>
                            <button type="button" onClick={() => move(-1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft disabled:opacity-30" aria-label="Move left">
                              <ChevronLeft className="size-4" />
                            </button>
                            <button type="button" onClick={() => move(1)} disabled={i === shown.length - 1} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft disabled:opacity-30" aria-label="Move right">
                              <ChevronRight className="size-4" />
                            </button>
                          </>
                        )}
                        <ConfirmAction
                          trigger={
                            <button type="button" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-alert-soft hover:text-alert" aria-label="Delete reel">
                              <Trash2 className="size-4" />
                            </button>
                          }
                          title="Delete this reel?"
                          description="It is removed from every page it shows on, and the video file is deleted from storage. This cannot be undone."
                          confirmLabel="Delete reel"
                          destructive
                          onConfirm={() => run(async () => unwrap(await deleteReelAction(r.id)), "Reel deleted")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          </>
        )}
      </section>

      {/* Brand film */}
      <section className={cn(card, "p-4 md:p-5")}>
        <h2 className="flex items-center gap-3 font-bold text-forest-text">
          <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
            <Film className="size-4" />
          </span>
          Home page film (YouTube)
        </h2>
        <p className="mt-1 mb-3 text-xs text-ink-muted">The big video in the &ldquo;We Are Pressers&rdquo; section of the home page. Paste any YouTube link. Leave empty to show the poster.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={film} onChange={(e) => setFilm(e.target.value)} placeholder="https://youtu.be/…" className={input} />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(async () => unwrap(await setBrandFilmAction(film)), "Home page film saved")}
            className="min-h-10 shrink-0 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
          >
            Save link
          </button>
        </div>
      </section>
    </div>
  );
}

/** "Replace" pill on a reel's thumbnail: pick a new video, it uploads (compressed) and swaps in place. */
function ReplaceVideo({ disabled, onUploaded, onError }: { disabled?: boolean; onUploaded: (u: Awaited<ReturnType<typeof uploadToCloudinary>>) => void; onError: (text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ stage: "compress" | "upload"; pct: number } | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setState({ stage: "upload", pct: 0 });
    try {
      const up = await uploadToCloudinary(
        file,
        "reels",
        (pct) => setState((s) => (s ? { ...s, pct: Math.min(pct, 99) } : s)),
        (stage) => setState((s) => (s ? { ...s, stage } : s)),
      );
      onUploaded(up);
    } catch (e) {
      onError((e as Error).message || "Upload failed");
    } finally {
      setState(null);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept="video/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {state ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 text-white">
          <div className="w-3/4 text-center">
            <Loader2 className="mx-auto size-6 animate-spin" />
            <p className="mt-2 text-xs font-semibold">{state.stage === "compress" ? "Compressing…" : `Uploading ${state.pct}%`}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full bg-white transition-[width]" style={{ width: `${state.stage === "compress" ? 15 : state.pct}%` }} />
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          className="absolute right-2 top-2 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/80 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" /> Replace video
        </button>
      )}
    </>
  );
}
