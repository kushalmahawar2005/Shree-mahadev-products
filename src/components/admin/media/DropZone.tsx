"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { UploadedImage } from "@/lib/media-actions";
import { uploadToCloudinary } from "./upload";

type Job = { name: string; pct: number; error?: string };

/** Drag & drop / click / paste uploader. Files go straight to Cloudinary. */
export function DropZone({
  folder,
  multiple = true,
  label = "Drop photos here, or click to choose",
  hint,
  compact,
  onUploaded,
}: {
  folder: "products" | "banners" | "reels" | "collections";
  multiple?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
  onUploaded: (images: UploadedImage[]) => Promise<void> | void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const busy = jobs.some((j) => j.pct < 100 && !j.error);

  async function handle(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).filter((f) =>
      folder === "reels" ? f.type.startsWith("video/") : f.type.startsWith("image/") || /\.heic$/i.test(f.name),
    );
    if (!files.length) return;
    const picked = multiple ? files.slice(0, folder === "reels" ? 10 : 20) : files.slice(0, 1);
    setJobs(picked.map((f) => ({ name: f.name, pct: 0 })));
    const results = await Promise.all(
      picked.map((f, i) =>
        uploadToCloudinary(f, folder, (pct) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, pct: Math.min(pct, 99) } : j))))
          .then((r) => {
            setJobs((js) => js.map((j, k) => (k === i ? { ...j, pct: 100 } : j)));
            return r;
          })
          .catch((e: Error) => {
            setJobs((js) => js.map((j, k) => (k === i ? { ...j, error: e.message } : j)));
            return null;
          }),
      ),
    );
    const ok = results.filter((r): r is UploadedImage => !!r);
    if (ok.length) await onUploaded(ok);
    setJobs((js) => js.filter((j) => j.error));
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files);
        }}
        onPaste={(e) => void handle(e.clipboardData.files)}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center transition-colors",
          compact ? "min-h-24 p-3" : "min-h-40 p-6",
          over ? "border-forest bg-forest/5" : "border-line bg-khaki-soft/50 hover:border-forest/50",
          busy && "cursor-wait opacity-70",
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-7 text-forest" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-semibold text-forest-text">{busy ? "Uploading…" : label}</span>
        {hint && <span className="text-sm text-ink-muted">{hint}</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept={folder === "reels" ? "video/mp4,video/quicktime,video/webm" : "image/*,.heic"}
        multiple={multiple}
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
      {jobs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {jobs.map((j, i) => (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{j.name}</span>
                <span className={j.error ? "text-sale" : "text-ink-muted"}>{j.error ?? `${j.pct}%`}</span>
              </div>
              {!j.error && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full origin-left bg-forest transition-transform" style={{ transform: `scaleX(${j.pct / 100})` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
