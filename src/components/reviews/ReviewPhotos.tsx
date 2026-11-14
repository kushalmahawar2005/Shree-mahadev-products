"use client";

import { X } from "lucide-react";
import { Camera } from "@/components/icons/duo";

export type PickedPhoto = { file: File; url: string };
export type UploadedPhoto = { url: string; publicId: string };
type Signature = { apiKey: string; timestamp: number; folder: string; allowed_formats: string; signature: string; cloudName: string };

export const MAX_REVIEW_PHOTOS = 3;

/** Uploads picked photos straight to Cloudinary with a server-signed request. */
export async function uploadReviewPhotos(files: File[], sign: () => Promise<({ ok: true } & Signature) | { ok: false; error: string }>): Promise<UploadedPhoto[]> {
  if (!files.length) return [];
  if (files.length > MAX_REVIEW_PHOTOS || files.some((f) => !f.type.startsWith("image/"))) throw new Error(`Choose up to ${MAX_REVIEW_PHOTOS} image files.`);
  const s = await sign();
  if (!s.ok) throw new Error(s.error);
  const out: UploadedPhoto[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", s.apiKey);
    form.append("timestamp", String(s.timestamp));
    form.append("folder", s.folder);
    form.append("allowed_formats", s.allowed_formats);
    form.append("signature", s.signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error("A photo couldn't be uploaded. Please remove it and try again.");
    const image = await res.json();
    out.push({ url: image.secure_url, publicId: image.public_id });
  }
  return out;
}

/** Up to 3 photo thumbnails with remove buttons + a camera tile to add more. */
export function ReviewPhotoPicker({ files, onChange }: { files: PickedPhoto[]; onChange: (next: PickedPhoto[]) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Photos (optional, up to {MAX_REVIEW_PHOTOS})</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f, n) => (
          <span key={f.url} className="relative size-20 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
            <img src={f.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, k) => k !== n))}
              aria-label="Remove photo"
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {files.length < MAX_REVIEW_PHOTOS && (
          <label className="grid size-20 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-muted hover:border-forest/40 hover:text-forest">
            <Camera className="size-6" />
            <span className="sr-only">Add photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                onChange([...files, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_REVIEW_PHOTOS));
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
