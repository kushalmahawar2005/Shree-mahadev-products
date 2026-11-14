"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/shadcn/carousel";
import { ReelViewer, type ReelItem } from "@/components/home/Reels";
import { VideoTile } from "@/components/home/VideoTile";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";

const posterOf = (r: ReelItem) => r.posterUrl || cldVideoPoster(r.videoUrl, 360);

/**
 * This product's own short videos, next to the buy box (admin: Reels → "Its product page").
 * Two-up muted previews that play when in view (hover on desktop); tap opens the full-screen
 * reel viewer with Add to cart. Renders nothing when the product has no videos.
 */
export function ProductVideos({ reels }: { reels: ReelItem[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [open, setOpen] = useState<number | null>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });

  useEffect(() => {
    if (!api) return;
    const sync = () => setEdge({ prev: api.canScrollPrev(), next: api.canScrollNext() });
    sync();
    api.on("select", sync).on("reInit", sync);
    return () => {
      api.off("select", sync).off("reInit", sync);
    };
  }, [api]);

  if (!reels.length) return null;
  const arrow =
    "absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-opacity disabled:pointer-events-none disabled:opacity-0";

  return (
    <section aria-label="Product videos" className="mt-5">
      <p className="text-[15px] font-bold text-forest-text">See it for yourself</p>
      <div className="relative mt-2.5">
        <Carousel setApi={setApi} opts={{ align: "start", containScroll: "trimSnaps" }}>
          <CarouselContent className="-ml-2.5">
            {reels.map((r, i) => (
              <CarouselItem key={r.id} className="basis-[46%] pl-2.5 sm:basis-1/3">
                <VideoTile
                  src={r.embedUrl ? undefined : cldVideo(r.videoUrl, 360)}
                  poster={posterOf(r)}
                  title={r.caption || "Watch"}
                  compact
                  playOnHover
                  onOpen={() => setOpen(i)}
                  className="aspect-[9/16] w-full rounded-2xl"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        <button type="button" aria-label="Previous video" disabled={!edge.prev} onClick={() => api?.scrollPrev()} className={cn(arrow, "left-2")}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" aria-label="Next video" disabled={!edge.next} onClick={() => api?.scrollNext()} className={cn(arrow, "right-2")}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <ReelViewer reels={reels} start={open} onClose={() => setOpen(null)} />
    </section>
  );
}
