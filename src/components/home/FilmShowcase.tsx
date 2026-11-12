"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/shadcn/dialog";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";
import { youtubeIdFrom } from "./BrandFilm";
import type { ReelItem } from "./Reels";
import { VideoTile, type TileProduct } from "./VideoTile";

const FILM = { src: "/videos/ghani-film.mp4", poster: "/videos/ghani-film.jpg" };
const EASE = [0.22, 1, 0.36, 1] as const;

const shortTitle = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "");

/** Every reel carries a chip; a reel without a tagged product links to the oils collection. */
function chipFor(reel: ReelItem): TileProduct {
  return reel.product
    ? { href: `/products/${reel.product.handle}`, title: shortTitle(reel.product.title), image: reel.product.image, price: reel.product.price }
    : { href: "/collections/wood-pressed-oils", title: "Shop wood-pressed oils" };
}

type Open = { kind: "film" } | { kind: "reel"; i: number } | null;

/**
 * Brand film showcase: the main film (8 of 12 columns, 16:10) beside two reels stacked in equal
 * rows that exactly fill the film's height. Tablet: film full width, reels 2-up below (4:5).
 * Phone: film 4:5, reels in a snap carousel. Any tile opens a sound-on player in a dialog.
 */
export function FilmShowcase({
  youtube,
  title,
  subtitle,
  reels,
}: {
  youtube: string;
  title: string;
  subtitle: string;
  reels: ReelItem[];
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Open>(null);
  const youtubeId = youtubeIdFrom(youtube);
  const two = reels.slice(0, 2);

  const rise = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.6, delay: i * 0.08, ease: EASE },
        };

  const openReel = open?.kind === "reel" ? two[open.i] : undefined;

  return (
    <>
      <div className={cn("grid gap-4 lg:gap-5", two.length && "lg:grid-cols-12")}>
        <motion.div {...rise(0)} className={cn("aspect-[16/11] md:aspect-[16/10]", two.length && "lg:col-span-8")}>
          <VideoTile
            src={youtubeId ? undefined : FILM.src}
            poster={youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg` : FILM.poster}
            title={title}
            subtitle={subtitle}
            soundPill
            lazy={false}
            onOpen={() => setOpen({ kind: "film" })}
            className="size-full"
          />
        </motion.div>

        {two.length > 0 && (
          // Phone: two small cards side by side (3:4). md: two side by side at 4:5.
          // lg: two equal rows that fill the film's row height exactly (min-h-0 so content can't stretch it).
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-4 lg:min-h-0 lg:grid-cols-1 lg:grid-rows-2 lg:gap-5">
            {two.map((r, i) => (
              <motion.div
                key={r.id}
                {...rise(i + 1)}
                className="aspect-[3/4] md:aspect-[4/5] lg:aspect-auto lg:min-h-0"
              >
                <VideoTile
                  src={cldVideo(r.videoUrl, 720)}
                  poster={cldVideoPoster(r.videoUrl, 720)}
                  title={r.caption || "From our ghani"}
                  product={chipFor(r)}
                  compact
                  onOpen={() => setOpen({ kind: "reel", i })}
                  className="size-full"
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Sound-on player */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "max-w-none gap-0 overflow-hidden rounded-3xl border-0 bg-black p-0 sm:max-w-none",
            open?.kind === "reel" ? "w-[min(420px,calc(100vw-2rem))]" : "w-[min(1100px,calc(100vw-2rem))]",
          )}
        >
          <DialogTitle className="sr-only">{open?.kind === "reel" ? openReel?.caption || "Reel" : title}</DialogTitle>
          {open?.kind === "film" &&
            (youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
                title={title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            ) : (
              <video src={FILM.src} poster={FILM.poster} autoPlay controls playsInline className="aspect-video w-full bg-black" />
            ))}
          {openReel && (
            <video
              src={cldVideo(openReel.videoUrl, 1080)}
              poster={cldVideoPoster(openReel.videoUrl, 720)}
              autoPlay
              controls
              playsInline
              className="aspect-[9/16] max-h-[85dvh] w-full bg-black object-contain"
            />
          )}
          <DialogClose
            aria-label="Close"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
