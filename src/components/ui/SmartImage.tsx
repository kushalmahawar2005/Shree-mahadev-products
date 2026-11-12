import type { ImageProps } from "next/image";
import { FallbackImage } from "./FallbackImage";

/**
 * next/image that skips optimisation for local SVG placeholders and, if a photo fails to load,
 * swaps in the neutral branded placeholder (never a broken-image icon).
 * Plain module on purpose: server components import `isPackshot` from here.
 */
export function SmartImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  return <FallbackImage {...props} unoptimized={props.unoptimized ?? src.endsWith(".svg")} alt={props.alt} />;
}

/** True for the client's 4:5 packshots (photo with its own backdrop): those fill a 4:5 frame edge to edge. */
export function isPackshot(img?: { width: number; height: number }) {
  return !!img && img.height > 0 && Math.abs(img.width / img.height - 0.8) < 0.03;
}
