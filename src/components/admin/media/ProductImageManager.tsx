"use client";

import { unwrap } from "@/lib/action-result";
import Image from "next/image";
import { useState, useTransition } from "react";
import {
  addProductImagesAction,
  deleteProductImageAction,
  reorderProductImagesAction,
  updateProductImageAltAction,
} from "@/lib/media-actions";
import type { ProductImage } from "@/lib/server/media";
import { DropZone } from "./DropZone";
import { Sortable } from "./Sortable";

export function ProductImageManager({
  handle,
  title,
  initial,
  compact = false,
}: {
  handle: string;
  title: string;
  initial: ProductImage[];
  /** Narrow side panel: small drop zone, 3-up thumbnails, no alt fields. */
  compact?: boolean;
}) {
  const [images, setImages] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message || "Something went wrong");
      }
    });

  return (
    <div className="space-y-4">
      <DropZone
        folder="products"
        compact={compact}
        label={compact ? "Drop photos or click" : undefined}
        hint={compact ? "First photo = main. Square looks best." : "JPG, PNG, WebP or HEIC. First photo is the main one. Square (1:1) photos look best."}
        onUploaded={async (ups) => {
          try {
            setImages(unwrap(await addProductImagesAction(handle, ups, title)));
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {error && <p className="text-sm text-sale">{error}</p>}
      {images.length === 0 ? (
        <p className="text-sm text-ink-muted">No photos yet. The storefront shows a placeholder until you add one.</p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">Drag to reorder{pending ? " · saving…" : ""}</p>
          <Sortable
            items={images}
            className={compact ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"}
            onReorder={(next) => {
              setImages(next);
              run(async () => unwrap(await reorderProductImagesAction(handle, next.map((i) => i.id))));
            }}
            render={(img, i, move) => (
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative aspect-square bg-khaki-soft">
                  <Image src={img.url} alt={img.alt} fill sizes="220px" className="object-cover" draggable={false} />
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-forest px-2 py-0.5 text-xs font-semibold text-white">Main</span>
                  )}
                </div>
                <div className={compact ? "flex items-center justify-between p-1" : "space-y-2 p-2"}>
                  {!compact && <input
                    defaultValue={img.alt}
                    placeholder="Alt text"
                    aria-label="Alt text"
                    onBlur={(e) => e.target.value !== img.alt && run(async () => unwrap(await updateProductImageAltAction(handle, img.id, e.target.value)))}
                    className="min-h-9 w-full rounded-lg border border-line px-2 text-sm"
                  />}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(-1)} disabled={i === 0} className={compact ? "size-7 rounded-md text-sm disabled:opacity-30" : "size-9 rounded-lg border border-line disabled:opacity-30"} aria-label="Move left">
                        ←
                      </button>
                      <button type="button" onClick={() => move(1)} disabled={i === images.length - 1} className={compact ? "size-7 rounded-md text-sm disabled:opacity-30" : "size-9 rounded-lg border border-line disabled:opacity-30"} aria-label="Move right">
                        →
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Delete this photo?")) return;
                        setImages((xs) => xs.filter((x) => x.id !== img.id));
                        run(async () => unwrap(await deleteProductImageAction(img.id)));
                      }}
                      className={compact ? "size-7 rounded-md text-sm text-red-700 hover:bg-red-50" : "min-h-9 rounded-lg px-2 text-sm font-semibold text-red-700 hover:bg-red-50"}
                    >
                      {compact ? "✕" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}
