import type { Metadata } from "next";
import { ContentGrid } from "@/components/content/ArticleShell";
import { Container } from "@/components/ui/primitives";
import { content } from "@/content";
import { pageMetadata } from "@/lib/utils/seo";

export const metadata: Metadata = pageMetadata({
  title: "Journal",
  description: "Notes on kachi ghani, our process and how to use real, unrefined oil.",
  path: "/journal",
});

export default function JournalPage() {
  const items = [...content.journal].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <Container className="py-10 md:py-16">
      <h1 className="text-4xl text-forest-text md:text-5xl">Journal</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-muted">Notes on kachi ghani, our process and how to use real, unrefined oil.</p>
      <div className="mt-8">
        <ContentGrid base="/journal" items={items} />
      </div>
    </Container>
  );
}
