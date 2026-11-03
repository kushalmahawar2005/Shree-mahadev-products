import Link from "next/link";
import { DragScroll } from "@/components/motion/DragScroll";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils/money";
import type { Product } from "@/lib/commerce/types";

const short = (t: string) => t.replace(/^(Wood|Cold)-Pressed\s+/, "").replace(/ Oil$/, "");

/** Signature element: every oil in its own swatch colour, English + Hindi names. */
export function OilShelf({ oils }: { oils: Product[] }) {
  return (
    <section className="py-14 md:py-20" aria-labelledby="shelf-title">
      <Container>
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="shelf-title" className="text-3xl md:text-4xl">
              The oil shelf
            </h2>
            <p className="mt-2 text-lg text-ink-muted">Twelve seeds, one wooden ghani.</p>
          </div>
          <Link href="/collections/wood-pressed-oils" className="font-semibold text-forest underline underline-offset-4">
            View all oils
          </Link>
        </Reveal>

        <DragScroll label="All wood-pressed oils" className="-mx-4 px-4 pb-2 sm:mx-0 sm:px-0">
          {oils.map((o) => (
            <Link
              key={o.handle}
              href={`/products/${o.handle}`}
              draggable={false}
              className="group flex w-36 shrink-0 snap-start flex-col justify-between rounded-[var(--radius-card)] p-4 transition-transform duration-300 hover:-translate-y-1 sm:w-44"
              style={{ backgroundColor: o.swatch ?? "#F6EFE2" }}
            >
              <span
                aria-hidden
                className="mx-auto mb-6 block h-24 w-10 rounded-t-[18px] rounded-b-lg border-2 border-black/10 bg-white/35 sm:h-28"
              />
              <span className={textTone(o.swatch)}>
                <span className="block font-display text-xl leading-tight">{short(o.title)}</span>
                <span className="block text-sm opacity-85" lang="hi">
                  {o.titleHi}
                </span>
                <span className="mt-2 block text-sm font-semibold">
                  {o.priceRange.min.amount ? `From ${formatMoney(o.priceRange.min)}` : "Coming soon"}
                </span>
              </span>
            </Link>
          ))}
        </DragScroll>
      </Container>
    </section>
  );
}

/** Pick dark or light text for contrast on the swatch. */
function textTone(hex?: string) {
  if (!hex) return "text-forest-text";
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.5 ? "text-forest-deep" : "text-white";
}
