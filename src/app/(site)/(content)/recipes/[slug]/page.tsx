import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/content/ArticleShell";
import { MadeWith } from "@/components/content/MadeWith";
import { content, getEntry, loadMdx } from "@/content";
import { getProducts } from "@/lib/commerce";
import { breadcrumbJsonLd, jsonLdString, pageMetadata, recipeJsonLd } from "@/lib/utils/seo";

export function generateStaticParams() {
  return content.recipes.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/recipes/[slug]">): Promise<Metadata> {
  const e = getEntry("recipes", (await params).slug);
  return e ? pageMetadata({ title: e.title, description: e.description, path: `/recipes/${e.slug}` }) : {};
}

// Blocking on purpose: an unknown handle must return a real HTTP 404 (not a streamed soft 404).
export const instant = false;

export default async function Entry({ params }: PageProps<"/recipes/[slug]">) {
  const { slug } = await params;
  const entry = getEntry("recipes", slug);
  const Body = await loadMdx("recipes", slug);
  if (!entry || !Body) notFound();
  const path = `/recipes/${slug}`;
  const used = entry.products?.length ? (await getProducts()).filter((p) => entry.products!.includes(p.handle)) : [];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            recipeJsonLd({ title: entry.title, description: entry.description, path, date: entry.date }),
            breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Recipes", path: "/recipes" }, { name: entry.title, path }]),
          ]),
        }}
      />
      <ArticleShell kicker="Recipe" backHref="/recipes" backLabel="Recipes" title={entry.title} description={entry.description} date={entry.date} after={used.length > 0 && <MadeWith title="Made with" products={used} />}>
        <Body />
      </ArticleShell>
    </>
  );
}
