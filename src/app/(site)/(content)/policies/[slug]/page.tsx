import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/content/ArticleShell";
import { content, getEntry, loadMdx } from "@/content";
import { breadcrumbJsonLd, jsonLdString, pageMetadata } from "@/lib/utils/seo";

export function generateStaticParams() {
  return content.policies.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const e = getEntry("policies", (await params).slug);
  return e ? pageMetadata({ title: e.title, description: e.description, path: `/policies/${e.slug}` }) : {};
}

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const entry = getEntry("policies", slug);
  const Body = await loadMdx("policies", slug);
  if (!entry || !Body) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: entry.title, path: `/policies/${slug}` }])),
        }}
      />
      <ArticleShell kicker="Policy" backHref="/" backLabel="Home" title={entry.title} updated={entry.updated}>
        <Body />
      </ArticleShell>
    </>
  );
}
