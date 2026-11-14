"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Link2, Loader2, Play, Plus, X } from "lucide-react";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { parseReelLink, reelEmbedSrc, reelLinkHref, reelLinkPoster } from "@/lib/reel-link";
import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn/dialog";
import { cn } from "@/lib/utils/cn";
import { ReelFrame } from "@/components/home/ReelFrame";

/** 9:16 live player for a YouTube link (the same embed the store uses). */
export function ReelEmbed({ link, className }: { link: string; className?: string }) {
  const parsed = useMemo(() => parseReelLink(link), [link]);
  const src = parsed.ok ? reelEmbedSrc(parsed.link) : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  if (!src) return null;
  return (
    <div className={cn("relative aspect-[9/16] overflow-hidden rounded-2xl bg-black", className)}>
      {loaded !== src && (
        <div className="absolute inset-0 grid place-items-center text-white/70">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}
      <ReelFrame key={src} src={src} title="Reel preview" onLoad={() => setLoaded(src)} />
    </div>
  );
}

/**
 * Paste box with a live preview beside it. The reel starts playing as soon as the link is
 * recognised, so the admin can see it works before adding it.
 */
export function ReelLinkField({ onAdd, disabled, hint }: { onAdd: (canonicalUrl: string) => void; disabled?: boolean; hint?: string }) {
  const [url, setUrl] = useState("");
  const parsed = useMemo(() => (url.trim() ? parseReelLink(url) : null), [url]);
  const ok = parsed?.ok ? parsed.link : null;
  const canon = ok ? reelLinkHref(ok) : null;
  const status = canon ? "ok" : null;

  const add = () => {
    if (!ok || status !== "ok") return;
    onAdd(reelLinkHref(ok));
    setUrl("");
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-line bg-subtle p-4 sm:grid-cols-[1fr_200px]">
      <form
        className="min-w-0 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor="reel-link" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Link2 className="size-4 text-forest-fg" /> Paste a YouTube link
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id="reel-link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/shorts/…"
              aria-invalid={parsed ? !parsed.ok : undefined}
              className={cn(
                "h-10 w-full rounded-xl border bg-surface pr-9 pl-3.5 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:ring-2",
                parsed && !parsed.ok ? "border-sale/60 focus:ring-sale/15" : ok ? "border-forest/50 focus:ring-forest/15" : "border-line focus:border-forest-fg focus:ring-forest/15",
              )}
            />
            {url && (
              <button type="button" onClick={() => setUrl("")} aria-label="Clear" className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-muted hover:text-ink">
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={status !== "ok" || disabled}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {parsed && !parsed.ok ? (
            <motion.p key="err" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-sale" role="alert">
              {parsed.error}
            </motion.p>
          ) : ok ? (
            <motion.p key="ok" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs font-medium text-forest-fg">
              <CheckCircle2 className="size-3.5" />
              YouTube video found. Check the preview plays, then press Add.
            </motion.p>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-ink-muted">
              {hint ?? "YouTube Shorts or any YouTube video. It plays right here on the site, nothing opens outside."}
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      {/* Live preview */}
      <div className="mx-auto w-full max-w-[200px]">
        {status === "ok" && canon ? (
          <ReelEmbed link={canon} className="shadow-lg ring-1 ring-black/10" />
        ) : (
          <div className="grid aspect-[9/16] place-items-center rounded-2xl border border-dashed border-line bg-surface text-center text-xs text-ink-muted">
            <span className="flex flex-col items-center gap-2 px-4">
              <Play className="size-5" />
              Preview shows here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Thumbnail for a YouTube reel; click opens the live player in a dialog. */
export function ReelLinkThumb({ link, cover, className }: { link: string; cover?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const p = parseReelLink(link);
  const poster = cover || (p.ok ? reelLinkPoster(p.link) : null);
    return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Preview reel"
        className={cn("group relative grid aspect-[9/16] place-items-center overflow-hidden bg-black text-white", className)}
      >
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element -- remote YouTube still / Cloudinary cover
          <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <span className="relative grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur transition-transform group-hover:scale-110">
          <Play className="ml-0.5 size-4 fill-white" />
        </span>
        <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-black/55">
          <YoutubeLogo className="size-3.5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(92vw,380px)] gap-3 p-3 sm:max-w-[380px]">
          <DialogTitle className="sr-only">Reel preview</DialogTitle>
          {open && <ReelEmbed link={link} />}
          <a href={link} target="_blank" rel="noreferrer" className="truncate text-center text-xs font-medium text-forest-fg hover:underline">
            {link}
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
