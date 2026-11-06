import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/content/ArticleShell";
import { MadeWith } from "@/components/content/MadeWith";
import { content, getEntry, loadMdx } from "@/content";
import { getProducts } from "@/lib/commerce";
import { breadcrumbJsonLd, jsonLdString, pageMetadata, articleJsonLd } from "@/lib/utils/seo";

export function generateStaticParams() {
  return content.journal.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const e = getEntry("journal", (await params).slug);
  return e ? pageMetadata({ title: e.title, description: e.description, path: `/journal/${e.slug}` }) : {};
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

export default async function Entry({ params }: PageProps<"/journal/[slug]">) {
  const { slug } = await params;
  const entry = getEntry("journal", slug);
  const Body = await loadMdx("journal", slug);
  if (!entry || !Body) notFound();
  const path = `/journal/${slug}`;
  const used = entry.products?.length ? (await getProducts()).filter((p) => entry.products!.includes(p.handle)) : [];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            articleJsonLd({ title: entry.title, description: entry.description, path, date: entry.date }),
            breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Journal", path: "/journal" }, { name: entry.title, path }]),
          ]),
        }}
      />
      <ArticleShell kicker="Journal" backHref="/journal" backLabel="Journal" title={entry.title} description={entry.description} date={entry.date} after={used.length > 0 && <MadeWith title="Mentioned here" products={used} />}>
        <Body />
      </ArticleShell>
    </>
  );
}
