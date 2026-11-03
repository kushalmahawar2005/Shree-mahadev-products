"use client";

import { signUploadAction, type UploadedImage } from "@/lib/media-actions";

const MAX_BYTES = 9.5 * 1024 * 1024; // Cloudinary free plan: 10 MB per image
const MAX_SIDE = 4000;

/**
 * Keep the original whenever possible (no quality loss). Only very large camera files are
 * downscaled in the browser to ≤4000px at 95% quality, which is still far above what the site shows.
 * Delivery-time compression (AVIF/WebP + q_auto) happens on Cloudinary's CDN.
 */
async function prepare(file: File): Promise<Blob> {
  if (file.size <= MAX_BYTES) return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file; // e.g. HEIC the browser can't decode: let Cloudinary try
  }
  let scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  for (let i = 0; i < 4; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.95));
    if (blob && blob.size <= MAX_BYTES) return blob;
    scale *= 0.8;
  }
  return file;
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // Cloudinary free plan: 100 MB per video

export async function uploadToCloudinary(
  file: File,
  folder: "products" | "banners" | "reels",
  onProgress?: (pct: number) => void,
): Promise<UploadedImage> {
  const isVideo = folder === "reels";
  if (isVideo) {
    if (!file.type.startsWith("video/")) throw new Error(`${file.name} is not a video`);
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`${file.name} is over 100 MB. Export it at 1080p or lower.`);
  } else if (!file.type.startsWith("image/") && !/\.heic$/i.test(file.name)) {
    throw new Error(`${file.name} is not an image`);
  }
  const [blob, sig] = await Promise.all([isVideo ? file : prepare(file), signUploadAction(folder)]);
  const fd = new FormData();
  fd.append("file", blob, file.name);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);
  fd.append("allowed_formats", sig.allowed_formats);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const r = JSON.parse(xhr.responseText);
        if (xhr.status >= 300) return reject(new Error(r.error?.message ?? "Upload failed"));
        resolve({ publicId: r.public_id, url: r.secure_url, width: r.width, height: r.height, duration: r.duration });
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(fd);
  });
}
