import { cn } from "@/lib/utils/cn";

/**
 * Kolhu (traditional wooden oil press turned by a bullock), from the client's line drawing
 * (public/icons/kolhu.png, transparent). Used as a CSS mask so it takes the text colour like a
 * lucide icon. The height comes from className (e.g. size-8); the width follows the 5:3 drawing.
 * No icon set has a kolhu, hence the image.
 */
export function KolhuIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block bg-current", className)}
      style={{
        width: "auto",
        aspectRatio: "5 / 3",
        maskImage: "url(/icons/kolhu.png)",
        WebkitMaskImage: "url(/icons/kolhu.png)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
