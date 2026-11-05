"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Clapperboard, Film, Trash2 } from "lucide-react";
import { Switch } from "@/components/shadcn/switch";
import { ConfirmAction } from "../order/ConfirmAction";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import {
  addReelsAction,
  deleteReelAction,
  reorderReelsAction,
  setBrandFilmAction,
  updateReelAction,
} from "@/lib/media-actions";
import type { Reel } from "@/lib/server/videos";
import { DropZone } from "./DropZone";
import { Sortable } from "./Sortable";

const input = "min-h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm focus:border-forest focus:outline-none";

export function ReelManager({
  initial,
  youtube,
  products,
}: {
  initial: Reel[];
  youtube: string;
  products: { handle: string; title: string }[];
}) {
  const [reels, setReels] = useState(initial);
  const [film, setFilm] = useState(youtube);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

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

  return (
    <div className="space-y-8">
      {msg && <p className={msg.ok ? "text-sm text-forest-fg" : "text-sm text-sale"}>{msg.text}</p>}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] md:p-5">
        <h2 className="flex items-center gap-3 font-bold text-forest-text"><span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg"><Film className="size-4" /></span>Brand film (YouTube)</h2>
        <p className="mt-1 mb-3 text-xs text-ink-muted">Shown in the &ldquo;We Are Pressers&rdquo; section. Paste any YouTube link. Leave empty to show the poster.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={film} onChange={(e) => setFilm(e.target.value)} placeholder="https://youtu.be/…" className={input} />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setBrandFilmAction(film), "Brand film saved")}
            className="min-h-10 shrink-0 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
          >
            Save link
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-3 font-bold text-forest-text"><span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg"><Clapperboard className="size-4" /></span>Reels</h2>
          <p className="text-sm text-ink-muted">
            Download your Instagram reels (MP4) and drop them here. Vertical 9:16 works best. They play muted on the homepage; tapping opens them with sound.
          </p>
        </div>
        <DropZone
          folder="reels"
          label="Drop reel videos here, or click to choose"
          hint="MP4 / MOV, up to 100 MB each. Cloudinary compresses them for the site."
          onUploaded={(ups) => run(() => addReelsAction(ups), `${ups.length} video(s) added`)}
        />
        {reels.length === 0 ? (
          <p className="text-sm text-ink-muted">No reels yet. The section stays hidden on the homepage until you add one.</p>
        ) : (
          <>
            <p className="text-sm text-ink-muted">Drag to reorder{pending ? " · saving…" : ""}</p>
            <Sortable
              items={reels}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              onReorder={(next) => {
                setReels(next);
                run(() => reorderReelsAction(next.map((r) => r.id)));
              }}
              render={(r, i, move) => (
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
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
                  <div className="space-y-2 p-2">
                    <input
                      defaultValue={r.caption}
                      placeholder="Caption (optional)"
                      aria-label="Caption"
                      onBlur={(e) => e.target.value !== r.caption && run(() => updateReelAction(r.id, { caption: e.target.value }))}
                      className={input}
                    />
                    <select
                      defaultValue={r.productHandle ?? ""}
                      aria-label="Linked product"
                      onChange={(e) => run(() => updateReelAction(r.id, { productHandle: e.target.value || null }))}
                      className={input}
                    >
                      <option value="">No product link</option>
                      {products.map((p) => (
                        <option key={p.handle} value={p.handle}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <input
                      defaultValue={r.instagramUrl ?? ""}
                      placeholder="Instagram post link (optional)"
                      aria-label="Instagram link"
                      onBlur={(e) => e.target.value !== (r.instagramUrl ?? "") && run(() => updateReelAction(r.id, { instagramUrl: e.target.value }))}
                      className={input}
                    />
                    <div className="flex items-center justify-between gap-1 border-t border-line pt-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                        <Switch
                          checked={r.active}
                          onCheckedChange={(on) => run(() => updateReelAction(r.id, { active: on }))}
                          className="data-[state=checked]:bg-forest"
                        />
                        {r.active ? "Live" : "Hidden"}
                      </label>
                      <div className="flex">
                        <button type="button" onClick={() => move(-1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft disabled:opacity-30" aria-label="Move left">
                          <ChevronLeft className="size-4" />
                        </button>
                        <button type="button" onClick={() => move(1)} disabled={i === reels.length - 1} className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-khaki-soft disabled:opacity-30" aria-label="Move right">
                          <ChevronRight className="size-4" />
                        </button>
                        <ConfirmAction
                          trigger={
                            <button type="button" className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-alert-soft hover:text-alert" aria-label="Delete video">
                              <Trash2 className="size-4" />
                            </button>
                          }
                          title="Delete this video?"
                          description="It is removed from the homepage reels. This cannot be undone."
                          confirmLabel="Delete video"
                          destructive
                          onConfirm={() => run(() => deleteReelAction(r.id))}
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
    </div>
  );
}
