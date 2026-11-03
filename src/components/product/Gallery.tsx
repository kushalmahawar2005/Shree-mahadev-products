"use client";

import { useRef, useState } from "react";
import { SmartImage } from "@/components/ui/SmartImage";
import type { ProductImage } from "@/lib/commerce/types";
import { cn } from "@/lib/utils/cn";

/** Swipeable on mobile (scroll-snap), thumbnails on desktop. */
export function Gallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    setActive(i);
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse">
      <div
        ref={track}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-card)] bg-khaki-soft"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== active) setActive(i);
        }}
        aria-label={`${title} images`}
        role="region"
      >
        {images.map((img, i) => (
          <div key={img.url} className="aspect-square w-full shrink-0 snap-center">
            <SmartImage
              src={img.url}
              alt={img.alt}
              width={img.width}
              height={img.height}
              priority={i === 0}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="size-full object-cover"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <div className="hidden w-20 flex-col gap-2 md:flex">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={cn(
                  "overflow-hidden rounded-[var(--radius-img)] border-2 bg-khaki-soft",
                  i === active ? "border-forest" : "border-transparent",
                )}
              >
                <SmartImage src={img.url} alt="" width={80} height={80} className="aspect-square object-cover" />
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-2 md:hidden" aria-hidden>
            {images.map((img, i) => (
              <span key={img.url} className={cn("size-2 rounded-full", i === active ? "bg-forest" : "bg-line")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
