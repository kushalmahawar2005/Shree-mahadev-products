"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical, ImageIcon, Loader2, Monitor, Smartphone, Trash2, X } from "lucide-react";
import { createBannersAction, deleteBannerAction, reorderBannersAction, updateBannerAction } from "@/lib/media-actions";
import type { Banner } from "@/lib/server/media";
import { Switch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils/cn";
import { ConfirmAction } from "../order/ConfirmAction";
import { DropZone } from "./DropZone";
import { Sortable } from "./Sortable";

const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const iconBtn = "grid size-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg disabled:opacity-30";

export function BannerManager({ initial }: { initial: Banner[] }) {
  const [banners, setBanners] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const live = banners.filter((b) => b.active).length;

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Hero banners</h1>
          <p className="mt-1 text-sm text-ink-muted">Homepage slider. Changes go live on the store right away.</p>
        </div>
        <p className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ink-muted">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <span className={cn("size-2 rounded-full", live ? "bg-forest-fg" : "bg-ink-muted")} />}
          {pending ? "Saving…" : `${live} of ${banners.length} slides live`}
        </p>
      </div>

      <DropZone
        folder="banners"
        label="Drop banner images to add slides"
        hint="Desktop 1600 × 650. Add a separate phone image (800 × 800) per slide below."
        onUploaded={(ups) => run(() => createBannersAction(ups))}
      />
      {error && <p className="rounded-xl border border-warm-line bg-warm px-4 py-2.5 text-sm text-sale">{error}</p>}

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <ImageIcon className="mx-auto size-8 text-ink-muted" />
          <p className="mt-2 text-sm text-ink-muted">No slides yet. The homepage shows the default placeholder slides.</p>
        </div>
      ) : (
        <Sortable
          items={banners}
          className="space-y-4"
          onReorder={(next) => {
            setBanners(next);
            run(() => reorderBannersAction(next.map((b) => b.id)));
          }}
          render={(b, i, move) => (
            <article className={cn("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]", !b.active && "opacity-75")}>
              <header className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
                <GripVertical className="size-4 cursor-grab text-ink-muted" aria-hidden />
                <span className="grid size-7 place-items-center rounded-lg bg-khaki-soft text-xs font-bold text-forest-fg">{i + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{b.alt || `Slide ${i + 1}`}</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                  {b.active ? "Live" : "Hidden"}
                  <Switch
                    checked={b.active}
                    onCheckedChange={(on) => run(() => updateBannerAction(b.id, { active: on }))}
                    className="data-[state=checked]:bg-forest"
                    aria-label={b.active ? "Hide slide" : "Show slide"}
                  />
                </label>
                <span className="mx-1 h-5 w-px bg-line" />
                <button type="button" onClick={() => move(-1)} disabled={i === 0} className={iconBtn} aria-label="Move up">
                  <ChevronUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(1)} disabled={i === banners.length - 1} className={iconBtn} aria-label="Move down">
                  <ChevronDown className="size-4" />
                </button>
                <ConfirmAction
                  trigger={
                    <button type="button" className={cn(iconBtn, "hover:bg-alert-soft hover:text-alert")} aria-label="Delete slide">
                      <Trash2 className="size-4" />
                    </button>
                  }
                  title="Delete this slide?"
                  description="It disappears from the homepage slider and its images are deleted. This cannot be undone."
                  confirmLabel="Delete slide"
                  destructive
                  onConfirm={() => run(() => deleteBannerAction(b.id))}
                />
              </header>

              <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <Monitor className="size-3.5" /> Desktop
                  </p>
                  {b.desktop && (
                    <div className="overflow-hidden rounded-xl border border-line bg-subtle">
                      <Image src={b.desktop.url} alt={b.alt} width={1600} height={650} sizes="(min-width:1024px) 640px, 100vw" className="aspect-[1600/650] w-full object-cover" draggable={false} />
                    </div>
                  )}
                  <DropZone folder="banners" multiple={false} compact label="Replace desktop image" onUploaded={([u]) => run(() => updateBannerAction(b.id, { desktop: u }))} />
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <Smartphone className="size-3.5" /> Phone <span className="text-ink-muted/70">(optional)</span>
                  </p>
                  {b.mobile && (
                    <div className="relative mx-auto max-w-[220px] overflow-hidden rounded-xl border border-line bg-subtle lg:max-w-none">
                      <Image src={b.mobile.url} alt={b.alt} width={800} height={800} sizes="260px" className="aspect-square w-full object-cover" draggable={false} />
                      <button
                        type="button"
                        onClick={() => run(() => updateBannerAction(b.id, { mobile: null }))}
                        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-surface/90 text-ink-muted shadow-sm hover:text-alert"
                        aria-label="Remove phone image"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <DropZone folder="banners" multiple={false} compact label={b.mobile ? "Replace phone image" : "Add phone image"} onUploaded={([u]) => run(() => updateBannerAction(b.id, { mobile: u }))} />
                </div>
              </div>

              <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 sm:p-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">Link when tapped</span>
                  <input defaultValue={b.href} placeholder="/shop or /products/…" className={input} onBlur={(e) => e.target.value !== b.href && run(() => updateBannerAction(b.id, { href: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-muted">Alt text (what the banner says)</span>
                  <input defaultValue={b.alt} className={input} onBlur={(e) => e.target.value !== b.alt && run(() => updateBannerAction(b.id, { alt: e.target.value }))} />
                </label>
              </div>
            </article>
          )}
        />
      )}
    </div>
  );
}
