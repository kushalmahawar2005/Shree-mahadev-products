import Link from "next/link";
import { Container } from "@/components/ui/primitives";

const fmt = (d: string) =>
  new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Shared layout for policies, recipes and journal posts: readable column, title, date, back link. */
export function ArticleShell({
  kicker,
  backHref,
  backLabel,
  title,
  description,
  date,
  updated,
  children,
}: {
  kicker: string;
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  date?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="max-w-3xl py-10 md:py-16">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href={backHref} className="hover:text-forest hover:underline">
          ← {backLabel}
        </Link>
      </nav>
      <p className="mt-6 text-sm font-semibold text-mustard">{kicker}</p>
      <h1 className="mt-1 text-3xl leading-tight text-forest-text md:text-5xl">{title}</h1>
      {description && <p className="mt-3 text-lg text-ink-muted">{description}</p>}
      {(date || updated) && (
        <p className="mt-3 text-sm text-ink-muted">
          {updated ? (
            <>
              Last updated: <time dateTime={updated}>{fmt(updated)}</time>
            </>
          ) : (
            <time dateTime={date}>{fmt(date!)}</time>
          )}
        </p>
      )}
      <hr className="my-8 border-line" />
      <article className="max-w-[70ch]">{children}</article>
    </Container>
  );
}

/** Card grid for /recipes and /journal. */
export function ContentGrid({
  base,
  items,
}: {
  base: "/recipes" | "/journal";
  items: { slug: string; title: string; description: string; date?: string; color?: string }[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <li key={it.slug}>
          <Link
            href={`${base}/${it.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#EFE6D2] bg-white transition-colors hover:border-forest/40"
          >
            <span aria-hidden className="block h-28 w-full" style={{ backgroundColor: it.color ?? "#F6EFE2" }} />
            <span className="flex flex-1 flex-col p-5">
              {it.date && <span className="text-xs text-ink-muted">{fmt(it.date)}</span>}
              <span className="mt-1 text-lg font-semibold text-forest-text group-hover:underline">{it.title}</span>
              <span className="mt-1 text-sm text-ink-muted">{it.description}</span>
              <span className="mt-auto pt-4 text-sm font-semibold text-forest">Read more →</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
