"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, ImagePlus, Loader2, RotateCw, X } from "lucide-react";
import { supportConfig } from "@/config/support";
import { signSupportPhotoUploadAction } from "@/lib/account/support-actions";

export type HelpPhoto = {
  key: string;
  file: File;
  preview: string;
  state: "uploading" | "done" | "error";
  error?: string;
  /** Upload/network failure (tap to retry) vs a file we refuse. */
  retryable?: boolean;
  url?: string;
  publicId?: string;
};

const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";
const EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

/** Up to 3 photos, uploaded straight to Cloudinary as soon as they're picked (checked again on the server on submit). */
export function PhotoPicker({ photos, setPhotos }: { photos: HelpPhoto[]; setPhotos: (fn: (p: HelpPhoto[]) => HelpPhoto[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = (key: string, p: Partial<HelpPhoto>) => setPhotos((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function upload(ph: HelpPhoto) {
    patch(ph.key, { state: "uploading", error: undefined, retryable: false });
    try {
      const s = await signSupportPhotoUploadAction();
      if (!s.ok) throw new Error(s.error);
      const form = new FormData();
      form.append("file", ph.file);
      form.append("api_key", s.apiKey);
      form.append("timestamp", String(s.timestamp));
      form.append("folder", s.folder);
      form.append("allowed_formats", s.allowed_formats);
      form.append("signature", s.signature);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error("Upload failed.");
      const j = (await r.json()) as { secure_url: string; public_id: string };
      patch(ph.key, { state: "done", url: j.secure_url, publicId: j.public_id });
    } catch (e) {
      patch(ph.key, { state: "error", retryable: true, error: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  function add(files: FileList | null) {
    if (!files) return;
    const room = supportConfig.photos.max - photos.length;
    const next: HelpPhoto[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const okType = (supportConfig.photos.mime as readonly string[]).includes(file.type) || EXT.test(file.name);
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      const ph: HelpPhoto = { key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, preview, state: "uploading" };
      if (!okType) next.push({ ...ph, state: "error", error: "Use JPG, PNG, WEBP or HEIC." });
      else if (file.size > supportConfig.photos.maxBytes) next.push({ ...ph, state: "error", error: "Too big. Max 5 MB." });
      else next.push(ph);
    }
    setPhotos((p) => [...p, ...next]);
    next.filter((p) => p.state === "uploading").forEach((p) => void upload(p));
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        Photos <span className="font-normal text-ink-muted">(optional, up to {supportConfig.photos.max})</span>
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">Photos of the bottle/box and the label help us resolve it faster.</p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {photos.map((p) => (
          <li key={p.key} className="relative size-24 overflow-hidden rounded-2xl border border-line bg-page">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote image */}
            <img src={p.preview} alt={`Photo ${p.file.name}`} className="size-full object-cover" />
            {p.state === "uploading" && (
              <span className="absolute inset-0 grid place-items-center bg-white/70" aria-label="Uploading">
                <Loader2 className="size-5 animate-spin text-forest-text" />
              </span>
            )}
            {p.state === "error" && (
              <button
                type="button"
                disabled={!p.retryable}
                onClick={() => void upload(p)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/85 p-1 text-center text-[11px] leading-tight font-semibold text-co-danger"
              >
                {p.retryable ? <RotateCw className="size-4" /> : <AlertCircle className="size-4" />}
                {p.error}
                {p.retryable && <span className="text-ink-muted">Tap to retry</span>}
              </button>
            )}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setPhotos((list) => list.filter((x) => x.key !== p.key))}
              className="absolute top-1 right-1 inline-grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow-co-card hover:text-co-danger"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {photos.length < supportConfig.photos.max && (
          <li>
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-co-border-strong text-xs font-semibold text-ink-muted hover:border-forest hover:text-ink focus-within:ring-4 focus-within:ring-forest/10">
              <ImagePlus className="size-5" />
              Add photo
              <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => add(e.target.files)} />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-ink-muted">JPG, PNG, WEBP or HEIC · up to 5 MB each</p>
    </div>
  );
}
