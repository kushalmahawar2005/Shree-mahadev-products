import Image from "next/image";

/** Tree green as it renders once the image is multiplied onto the footer cream (#16532c in the raw file). */
const COVER = "#154d27";

const FOOTER_ART = "https://res.cloudinary.com/bmqxsylj/image/upload/v1793735967/swadeshi-mahadev/static/images/footer-harvest.webp";

/** One flying bee, drawn around (0,0); animateMotion moves it along its loop above the hive. */
function Bee({ dur, begin, path, scale = 1 }: { dur: string; begin: string; path: string; scale?: number }) {
  return (
    <g>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
      <g transform={`scale(${scale})`}>
        <g className="bob">
          <g transform="rotate(-52 -1 1)">
            <ellipse className="wing" cx="-1" cy="-5.5" rx="2.6" ry="5.6" />
          </g>
          <g transform="rotate(34 1 1)">
            <ellipse className="wing" cx="1" cy="-6" rx="2.8" ry="6.2" />
          </g>
          <circle cx="-3" cy="2.2" r="3.1" fill="#f0a31c" />
          <circle cx="3.4" cy="2.4" r="3.1" fill="#f0a31c" />
          <circle cx="0.2" cy="2.3" r="1.6" fill="#c9861a" />
        </g>
      </g>
    </g>
  );
}

/** Falling seeds under the woman's sieve: [cx, cy, r, delay s, duration s]. */
const GRAINS: [number, number, number, number, number][] = [
  [494.6, 580.3, 1.2, -0.12, 0.62],
  [499.2, 582.8, 1.5, -0.61, 0.68],
  [503.0, 580.8, 1.1, -0.08, 0.68],
  [514.0, 582.5, 1.5, -0.64, 0.67],
  [496.7, 581.9, 1.4, -0.68, 0.91],
  [490.4, 581.8, 1.4, -0.4, 0.66],
  [501.3, 580.3, 1.6, -0.69, 0.79],
  [496.4, 582.7, 1.3, -0.71, 0.9],
  [502.2, 581.2, 1.4, -0.34, 0.66],
  [496.5, 582.4, 1.0, -0.04, 0.82],
  [495.9, 581.6, 1.3, -0.27, 0.95],
  [493.5, 581.2, 1.1, -0.51, 0.7],
  [498.0, 582.2, 1.2, -0.45, 0.92],
  [490.8, 580.2, 1.1, -0.61, 0.82],
];

/**
 * Footer harvest illustration with a light SVG animation on top (sun glow, oil streams, honey drip,
 * falling seeds, flying bees). The SVG viewBox matches the 2000×667 image pixels, so the image must
 * keep its natural ratio (width 100%, height auto, never cropped) for the overlay to line up.
 * Styles: `.kf` block in globals.css (hidden for prefers-reduced-motion).
 */
export function FooterHarvestArt({ className }: { className?: string }) {
  return (
    <div className={`kf ${className ?? ""}`}>
      <Image
        src={FOOTER_ART}
        alt="Illustration of mustard oil being pressed in a wooden kolhu and raw honey being harvested"
        width={2000}
        height={667}
        sizes="100vw"
        className="mix-blend-multiply"
      />
      <svg viewBox="0 0 2000 667" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="kf-sky">
            <path d="M1180 250H1480V471L1425 466 1380 460 1335 455 1290 451 1245 446 1180 440Z" />
          </clipPath>
          <radialGradient id="kf-halo">
            <stop offset=".55" stopColor="#fedc78" stopOpacity=".55" />
            <stop offset="1" stopColor="#fedc78" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Sun */}
        <g clipPath="url(#kf-sky)">
          <circle className="glow" cx="1330" cy="420" r="100" fill="url(#kf-halo)" />
          <circle className="ring" cx="1330" cy="420" r="57" />
          <circle className="ring r2" cx="1330" cy="420" r="57" />
          <circle cx="1330" cy="420" r="57.5" fill="#fedc78" />
        </g>
        {/* Oil streams (kolhu + pot) */}
        <path className="flow" strokeWidth="2.6" d="M947 530C948 542 947 558 947 577" />
        <path className="flow" strokeWidth="1.5" d="M1107 511C1103 520 1102.6 536 1103.5 557" style={{ animationDuration: ".7s" }} />
        {/* Honey drip */}
        <circle className="drop" cx="1646" cy="550" r="2" />
        <circle className="drop" cx="1646" cy="550" r="1.6" style={{ animationDelay: "-.8s" }} />
        {/* Seeds falling from the sieve */}
        {GRAINS.map(([cx, cy, r, delay, duration]) => (
          <circle
            key={`${cx}-${cy}`}
            className="grain"
            cx={cx}
            cy={cy}
            r={r}
            style={{ animationDelay: `${delay}s`, animationDuration: `${duration}s` }}
          />
        ))}
        {/* Bees: cover the painted static bees (colour = tree green after the image's multiply blend), then draw flying ones */}
        <circle cx="1696" cy="476" r="12" fill={COVER} />
        <circle cx="1727.5" cy="507" r="12" fill={COVER} />
        <circle cx="1767.5" cy="508" r="9" fill={COVER} />
        <Bee dur="7s" begin="0s" path="M1696 477c14-16 34-10 30 6s-22 26-34 14-10-8 4-20z" />
        <Bee dur="9s" begin="-3s" path="M1727 508c-16-8-30 4-22 16s30 6 40-6 14-24 2-24-8 18-20 14z" />
        <Bee dur="8s" begin="-5s" path="M1767 508c10-14 26-20 24-6s-18 8-30 14-26-4-14-14 12 14 20 6z" scale={0.75} />
      </svg>
    </div>
  );
}
