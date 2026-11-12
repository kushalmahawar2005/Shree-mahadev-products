import type { CSSProperties } from "react";

/**
 * Photo frame for product cards, inset from the white card. Plain: the packshots are JPGs on a
 * flat cream (#FBF5E5), so the frame uses the same cream and the photo shows as shot.
 * (A tinted gradient + multiply blend was tried on 2026-11-11; owner preferred the plain photo.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so callers can pass the swatch if a tint returns
export function stageStyle(_swatch?: string): CSSProperties {
  return { backgroundColor: "#fbf5e5" };
}

export const stageClass = "relative isolate block aspect-[4/5] overflow-hidden rounded-xl";

/** Extra classes for product photos inside the frame (none for now). */
export const stageImg = "";
