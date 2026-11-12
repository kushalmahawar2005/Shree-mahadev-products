import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { MessageCircle } from "@/components/icons/duo";
import { SearchBox } from "@/components/search/SearchBox";
import { PickCard } from "@/components/home/PickCard";
import { toPickProduct } from "@/components/home/pickProduct";
import { getProducts, searchProducts } from "@/lib/commerce";
import { whatsappLink } from "@/data/site";

export const metadata: Metadata = {
  title: "Search",
  description: "Search wood-pressed oils, raw honey and natural sweeteners.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

const POPULAR = ["Mustard oil", "Groundnut oil", "Raw honey", "Coconut oil", "Baby massage", "Desi khand", "Sesame oil"];

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1360px] px-4 pt-6 pb-10 md:px-8 md:pt-12 md:pb-24">
        <Suspense fallback={<SearchHeader />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80).trim() : "";
  const results = q ? await searchProducts(q) : [];
  const fallback = !q || !results.length ? (await getProducts()).filter((p) => p.priceRange.min.amount > 0).slice(0, 4) : [];

  return (
    <>
      <SearchHeader q={q} />

      {q && results.length > 0 && (
        <>
          <p className="mt-8 text-sm text-ink-muted" aria-live="polite">
            <span className="font-semibold text-forest-text tabular-nums">{results.length}</span> {results.length === 1 ? "result" : "results"} for &ldquo;
            <span className="font-semibold text-ink">{q}</span>&rdquo;
          </p>
          <Grid products={results} />
        </>
      )}

      {q && !results.length && (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-line bg-white px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-khaki-soft text-forest">
            <SearchX className="size-6" />
          </span>
          <p className="mt-4 text-lg font-bold text-forest-text">Nothing found for &ldquo;{q}&rdquo;</p>
          <p className="mt-1 max-w-md text-sm text-ink-muted">Try a simpler word like &ldquo;mustard&rdquo; or &ldquo;honey&rdquo;, or ask us on WhatsApp.</p>
          <a
            href={whatsappLink(`Hi, I'm looking for ${q}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-mid"
          >
            <MessageCircle className="size-4" /> Ask on WhatsApp
          </a>
        </div>
      )}

      {fallback.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl">{q ? "You might like" : "Popular right now"}</h2>
          <Grid products={fallback} />
        </section>
      )}
    </>
  );
}

function Grid({ products }: { products: Awaited<ReturnType<typeof getProducts>> }) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.handle}>
          <PickCard product={toPickProduct(p)} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}

function SearchHeader({ q = "" }: { q?: string }) {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="font-hindi text-base text-sale md:text-lg" lang="hi">
        क्या ढूंढ रहे हैं?
      </p>
      <h1 className="text-[28px] leading-tight md:text-5xl">Search the store</h1>
      <SearchBox q={q} />
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {POPULAR.map((t) => {
          const on = q.toLowerCase() === t.toLowerCase();
          return (
            <li key={t}>
              <Link
                href={`/search?q=${encodeURIComponent(t)}`}
                replace
                scroll={false}
                className={
                  on
                    ? "inline-flex h-8 items-center rounded-full bg-forest px-3.5 text-xs font-semibold text-white"
                    : "inline-flex h-8 items-center rounded-full border border-line bg-white/70 px-3.5 text-xs font-semibold text-ink-muted hover:border-forest/40 hover:text-forest"
                }
              >
                {t}
              </Link>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
