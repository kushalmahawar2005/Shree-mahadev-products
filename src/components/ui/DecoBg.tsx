import { cldUrl } from "@/lib/image-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Decorative full-bleed illustration as a CSS background (not <img>): it is never the
 * page's main content, so it shouldn't compete for LCP or need alt text.
 * Uses Cloudinary f_auto/q_auto with a responsive image-set.
 */
export function DecoBg({ src, className, position = "center" }: { src: string; className?: string; position?: string }) {
  const set = [960, 1600, 2400].map((w, i) => `url("${cldUrl(src, w)}") ${i + 1}x`).join(", ");
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 bg-cover bg-no-repeat", className)}
      style={{ backgroundImage: `image-set(${set})`, backgroundPosition: position }}
    />
  );
}
