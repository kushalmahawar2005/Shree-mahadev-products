"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { createBannersAction, deleteBannerAction, reorderBannersAction, updateBannerAction } from "@/lib/media-actions";
import type { Banner } from "@/lib/server/media";
import { DropZone } from "./DropZone";
import { Sortable } from "./Sortable";

const input = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-forest focus:outline-none";

export function BannerManager({ initial }: { initial: Banner[] }) {
  const [banners, setBanners] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Banner[] | void>) =>
    start(async () => {
      setError(null);
      try {
        const next = await fn();
        if (next) setBanners(next);
      } catch (e) {
        setError((e as Error).message || "Something went wrong");
      }
    });

  return (
    <div className="space-y-5">
      <DropZone
        folder="banners"
        label="Drop banner images to add slides"
        hint="Desktop 1600 × 650. Add a separate phone image (800 × 800) per slide below."
        onUploaded={(ups) => run(() => createBannersAction(ups))}
      />
      {error && <p className="text-sm text-sale">{error}</p>}
      {banners.length === 0 ? (
        <p className="text-sm text-ink-muted">No slides yet. The homepage shows the default placeholder slides.</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">Drag slides to change their order{pending ? " · saving…" : ""}</p>
          <Sortable
            items={banners}
            className="space-y-4"
            onReorder={(next) => {
              setBanners(next);
              run(() => reorderBannersAction(next.map((b) => b.id)));
            }}
            render={(b, i, move) => (
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-forest-text">Slide {i + 1}</p>
                  <div className="flex items-center gap-2">
                    <label className="flex min-h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={b.active}
                        onChange={(e) => run(() => updateBannerAction(b.id, { active: e.target.checked }))}
                        className="size-5 accent-[var(--color-forest)]"
                      />
                      Live
                    </label>
                    <button type="button" onClick={() => move(-1)} disabled={i === 0} className="size-9 rounded-lg border border-line disabled:opacity-30" aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(1)} disabled={i === banners.length - 1} className="size-9 rounded-lg border border-line disabled:opacity-30" aria-label="Move down">
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Delete this slide?")) run(() => deleteBannerAction(b.id));
                      }}
                      className="min-h-9 rounded-lg px-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Desktop</p>
                    {b.desktop && (
                      <Image src={b.desktop.url} alt={b.alt} width={1600} height={650} sizes="600px" className="w-full rounded-xl" draggable={false} />
                    )}
                    <DropZone folder="banners" multiple={false} compact label="Replace desktop image" onUploaded={([u]) => run(() => updateBannerAction(b.id, { desktop: u }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Phone (optional)</p>
                    {b.mobile ? (
                      <>
                        <Image src={b.mobile.url} alt={b.alt} width={800} height={800} sizes="300px" className="w-full rounded-xl" draggable={false} />
                        <button type="button" onClick={() => run(() => updateBannerAction(b.id, { mobile: null }))} className="text-sm font-semibold text-red-700">
                          Remove phone image
                        </button>
                      </>
                    ) : null}
                    <DropZone folder="banners" multiple={false} compact label={b.mobile ? "Replace phone image" : "Add phone image"} onUploaded={([u]) => run(() => updateBannerAction(b.id, { mobile: u }))} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold">Link when tapped</span>
                    <input defaultValue={b.href} className={input} onBlur={(e) => e.target.value !== b.href && run(() => updateBannerAction(b.id, { href: e.target.value }))} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-semibold">Alt text (what the banner says)</span>
                    <input defaultValue={b.alt} className={input} onBlur={(e) => e.target.value !== b.alt && run(() => updateBannerAction(b.id, { alt: e.target.value }))} />
                  </label>
                </div>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
