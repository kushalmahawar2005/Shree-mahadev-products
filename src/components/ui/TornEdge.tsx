/**
 * Torn-paper edge where one section's colour hands over to the next (hand-drawn SVG; no library
 * has this). Put it as the first child of the lower section (relative, overflow-hidden): the
 * shape is filled with the colour of the section ABOVE, so the lower section looks like a fresh
 * page laid under a torn one. Pass `flip` to put it on the bottom edge instead.
 */
export function TornEdge({ color = "var(--color-page)", flip = false }: { color?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 30"
      preserveAspectRatio="none"
      className={
        flip
          ? "pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-4 w-full rotate-180 drop-shadow-[0_-2px_2px_rgba(80,55,20,0.10)] md:h-6"
          : "pointer-events-none absolute inset-x-0 top-0 z-[1] h-4 w-full drop-shadow-[0_2px_2px_rgba(80,55,20,0.10)] md:h-6"
      }
    >
      <path fill={color} d="M0 0H1440V16L1440 16L1428 12.3L1406 15.5L1384 9.7L1369 11.2L1348 20.8L1322 15.4L1313 15.7L1301 15.5L1276 7.4L1264 20.3L1251 12.5L1240 8.4L1223 14.5L1197 20.6L1186 12.8L1171 11.0L1160 16.8L1136 7.4L1120 8.6L1109 7.0L1099 12.4L1087 10.3L1077 8.0L1057 8.7L1042 13.3L1019 21.0L997 21.4L987 17.8L967 15.2L947 22.2L928 12.9L912 7.1L898 16.4L881 10.7L868 9.8L857 22.3L833 12.7L816 11.5L793 20.1L769 15.8L752 8.3L728 13.3L715 9.1L693 7.9L682 9.7L665 7.4L645 13.2L631 20.2L605 17.4L584 8.0L564 14.6L539 20.4L522 16.3L503 18.1L489 21.0L470 19.2L450 7.6L432 9.4L410 13.7L399 22.7L385 18.7L362 15.4L343 10.9L322 19.7L308 14.3L289 12.0L273 17.9L260 8.0L250 15.8L235 17.2L216 9.9L193 11.9L182 9.3L168 20.7L158 22.6L143 16.2L117 17.0L105 9.0L82 13.8L71 8.1L55 7.6L37 7.9L22 15.6L12 17.4L0 12.2Z" />
    </svg>
  );
}
