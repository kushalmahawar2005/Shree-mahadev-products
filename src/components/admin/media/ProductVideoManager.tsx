"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { addReelsAction, deleteReelAction, updateReelAction } from "@/lib/media-actions";
import type { Reel } from "@/lib/server/videos";
import { cldVideo, cldVideoPoster } from "@/lib/image-loader";
import { Switch } from "@/components/shadcn/switch";
import { ConfirmAction } from "../order/ConfirmAction";
import { DropZone } from "./DropZone";

/**
 * Product edit page: this product's own videos (shown on its page next to the buy box).
 * Uploads are compressed in the browser, saved as reels tagged with this product and placed on
 * "Its product page". Everything else (home, category pages) stays on /admin/videos.
 */
export function ProductVideoManager({ handle, initial }: { handle: string; initial: Reel[] }) {
  const mine = (list: Reel[]) => list.filter((r) => r.productHandle === handle && r.placements.includes("product"));
  const [reels, setReels] = useState(() => mine(initial));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Reel[]>) =>
    start(async () => {
      setErr(null);
      try {
        setReels(mine(await fn()));
      } catch (e) {
        setErr((e as Error).message || "Something went wrong");
      }
    });

  return (
    <div className="space-y-3">
      {reels.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {reels.map((r) => (
            <li key={r.id} className="space-y-1.5">
              <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-subtle">
                <video src={cldVideo(r.videoUrl, 240)} poster={cldVideoPoster(r.videoUrl, 240)} muted loop playsInline preload="none" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} className="size-full object-cover" />
                <ConfirmAction
                  trigger={
                    <button type="button" aria-label="Delete video" className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/50 text-white hover:bg-alert">
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                  title="Delete this video?"
                  description="It is removed from this product's page and from Cloudinary."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => run(async () => unwrap(await deleteReelAction(r.id)))}
                />
              </div>
              <input
                defaultValue={r.caption}
                placeholder="Caption"
                aria-label="Caption"
                onBlur={(e) => e.target.value !== r.caption && run(async () => unwrap(await updateReelAction(r.id, { caption: e.target.value })))}
                className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-xs"
              />
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
                <Switch checked={r.active} onCheckedChange={(on) => run(async () => unwrap(await updateReelAction(r.id, { active: on })))} className="data-[state=checked]:bg-forest" />
                {r.active ? "Live" : "Hidden"}
              </label>
            </li>
          ))}
        </ul>
      )}
      <DropZone
        folder="reels"
        multiple
        compact
        label="Add product videos"
        hint="Any size, it is shrunk before upload. Vertical 9:16 looks best."
        onUploaded={(ups) => run(async () => unwrap(await addReelsAction(ups, ["product"], handle)))}
      />
      {pending && <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Loader2 className="size-3.5 animate-spin" /> Saving…</p>}
      {err && <p className="text-xs text-alert">{err}</p>}
    </div>
  );
}
