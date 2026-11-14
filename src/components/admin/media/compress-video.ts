"use client";

/**
 * Shrinks a video in the browser before upload, so any phone/camera file (even 300 MB, 4K)
 * goes up small and fast. Uses mediabunny (WebCodecs, hardware encoder, no ffmpeg.wasm):
 * longest side ≤ 1280 px, H.264 + AAC MP4 at a web-friendly bitrate. Cloudinary still
 * compresses again on arrival (VIDEO_INCOMING), so this only has to get the file small.
 *
 * Falls back to the original file when the browser can't encode (old Safari/Firefox),
 * or when the "compressed" file would not actually be smaller.
 */
const MAX_SIDE = 1280;
const SKIP_BELOW = 6 * 1024 * 1024; // small clips: not worth re-encoding

export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  if (file.size < SKIP_BELOW || typeof VideoEncoder === "undefined") return file;
  try {
    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_MEDIUM, canEncodeVideo } =
      await import("mediabunny");
    if (!(await canEncodeVideo("avc"))) return file;

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: (track) => {
        const w = track.displayWidth;
        const h = track.displayHeight;
        const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        // Even dimensions keep H.264 encoders happy.
        const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
        return { width: even(w), height: even(h), fit: "contain", codec: "avc", bitrate: QUALITY_MEDIUM, frameRate: 30 };
      },
      audio: { codec: "aac", bitrate: 128_000 },
    });
    if (!conversion.isValid) return file;
    conversion.onProgress = (p) => onProgress?.(Math.round(p * 100));
    await conversion.execute();

    const buffer = target.buffer;
    if (!buffer || buffer.byteLength >= file.size) return file;
    return new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    console.warn("Video compression skipped:", e);
    return file;
  }
}
