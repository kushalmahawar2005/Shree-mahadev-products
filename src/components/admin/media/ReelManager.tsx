"use client";

import { useState, useTransition } from "react";
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

const input = "min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-forest focus:outline-none";

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
      {msg && <p className={msg.ok ? "text-sm text-forest" : "text-sm text-sale"}>{msg.text}</p>}

      <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
        <h2 className="text-lg font-semibold text-forest-text">Brand film (YouTube)</h2>
        <p className="mb-3 text-sm text-ink-muted">Shown in the &ldquo;We Are Pressers&rdquo; section. Paste any YouTube link. Leave empty to show the poster.</p>
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
          <h2 className="text-lg font-semibold text-forest-text">Reels</h2>
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
                <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
                    <div className="flex items-center justify-between gap-1">
                      <label className="flex min-h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={(e) => run(() => updateReelAction(r.id, { active: e.target.checked }))}
                          className="size-4 accent-[var(--color-forest)]"
                        />
                        Live
                      </label>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => move(-1)} disabled={i === 0} className="size-9 rounded-lg border border-line disabled:opacity-30" aria-label="Move left">
                          ←
                        </button>
                        <button type="button" onClick={() => move(1)} disabled={i === reels.length - 1} className="size-9 rounded-lg border border-line disabled:opacity-30" aria-label="Move right">
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Delete this video?")) run(() => deleteReelAction(r.id));
                          }}
                          className="min-h-9 rounded-lg px-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
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
