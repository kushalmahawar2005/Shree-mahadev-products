import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ChefHat, FileText, MessageCircle } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/shadcn/breadcrumb";
import { site, whatsappLink } from "@/data/site";
import { cn } from "@/lib/utils/cn";

const fmt = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/** Shared layout for policies, recipes and journal posts: breadcrumb, title block, readable white article card. */
export function ArticleShell({
  kicker,
  backHref,
  backLabel,
  title,
  description,
  date,
  updated,
  nav,
  after,
  children,
}: {
  kicker: string;
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  date?: string;
  updated?: string;
  /** Sibling pages (e.g. the other policies) shown as pills under the title. */
  nav?: { href: string; label: string; active?: boolean }[];
  /** Full-width content after the article (e.g. products used). */
  after?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#F5EDDE]">
      <div className="mx-auto max-w-[900px] px-4 pt-6 pb-16 md:px-8 md:pt-8 md:pb-24">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {backHref !== "/" && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={backHref}>{backLabel}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-khaki/50 bg-white/60 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-sale uppercase">{kicker}</span>
          <h1 className="mt-3 text-3xl leading-tight md:text-5xl">{title}</h1>
          {description && <p className="mt-3 text-lg text-ink-muted">{description}</p>}
          {(date || updated) && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
              <CalendarDays className="size-4" />
              {updated ? (
                <>
                  Last updated <time dateTime={updated}>{fmt(updated)}</time>
                </>
              ) : (
                <time dateTime={date}>{fmt(date!)}</time>
              )}
            </p>
          )}
          {nav && nav.length > 1 && (
            <nav aria-label="Related pages" className="no-scrollbar -mx-1 mt-5 overflow-x-auto px-1">
              <ul className="flex w-max gap-2">
                {nav.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={n.active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                        n.active ? "bg-forest text-white" : "border border-line bg-white text-forest-text hover:border-forest/40",
                      )}
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>

        <article className="mt-8 rounded-3xl border border-line bg-white px-5 py-6 md:px-10 md:py-10">
          <div className="max-w-[70ch]">{children}</div>
        </article>

        {after}

        <aside className="mt-8 flex flex-col items-start justify-between gap-4 rounded-3xl bg-forest p-6 text-white sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-white">Have a question about this?</p>
            <p className="text-sm text-white/70">
              WhatsApp or call {site.phone}, {site.supportHours}.
            </p>
          </div>
          <a
            href={whatsappLink(`Hi, I have a question about "${title}".`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#e8c879] px-5 text-sm font-bold text-forest-deep hover:bg-white"
          >
            <MessageCircle className="size-4" /> Ask us
          </a>
        </aside>
      </div>
    </div>
  );
}

const fmtShort = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Card grid for /recipes and /journal. The newest item is featured wide. */
export function ContentGrid({ base, items }: { base: "/recipes" | "/journal"; items: { slug: string; title: string; description: string; date?: string; color?: string }[] }) {
  const Icon = base === "/recipes" ? ChefHat : BookOpen;
  if (!items.length)
    return (
      <div className="rounded-3xl border border-dashed border-line bg-white/60 p-12 text-center">
        <FileText className="mx-auto size-8 text-ink-muted" />
        <p className="mt-3 font-semibold text-forest-text">New posts are on the way.</p>
      </div>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => {
        const featured = i === 0 && items.length > 2;
        return (
          <li key={it.slug} className={featured ? "sm:col-span-2 lg:col-span-2" : undefined}>
            <Link
              href={`${base}/${it.slug}`}
              className={cn(
                "group flex h-full overflow-hidden rounded-3xl border border-line bg-white transition-shadow hover:shadow-[0_24px_48px_-32px_rgba(7,47,27,0.55)]",
                featured ? "flex-col md:flex-row" : "flex-col",
              )}
            >
              <span
                aria-hidden
                className={cn("relative grid shrink-0 place-items-center overflow-hidden", featured ? "aspect-[16/9] md:aspect-auto md:w-1/2" : "aspect-[16/9]")}
                style={{ background: `linear-gradient(135deg, ${it.color ?? "#F6EFE2"} 0%, #f6efe2 100%)` }}
              >
                <span className="grid size-16 place-items-center rounded-2xl bg-white/70 text-forest backdrop-blur transition-transform duration-500 group-hover:scale-110">
                  <Icon className="size-8" strokeWidth={1.5} />
                </span>
              </span>
              <span className="flex flex-1 flex-col p-5 md:p-6">
                {it.date && <span className="text-xs font-medium text-ink-muted">{fmtShort(it.date)}</span>}
                <span className={cn("mt-1 font-bold text-forest-text", featured ? "text-2xl" : "text-lg")}>{it.title}</span>
                <span className="mt-1.5 text-sm leading-relaxed text-ink-muted">{it.description}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-forest">
                  {base === "/recipes" ? "Get the recipe" : "Read more"} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
