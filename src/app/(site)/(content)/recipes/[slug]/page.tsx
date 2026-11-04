import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/content/ArticleShell";
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
      <ArticleShell kicker="Recipe" backHref="/recipes" backLabel="All recipes" title={entry.title} description={entry.description} date={entry.date}>
        <Body />
        {used.length > 0 && (
          <aside className="mt-10 rounded-2xl bg-khaki-soft p-5">
            <p className="font-semibold text-forest-text">Made with</p>
            <ul className="mt-2 space-y-1">
              {used.map((p) => (
                <li key={p.handle}>
                  <Link href={`/products/${p.handle}`} className="font-semibold text-forest underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </ArticleShell>
    </>
  );
}
