import Link from "next/link";
import { Fragment } from "react";

/*
 * Hand-rolled "markdown-lite" renderer for FAQ answers: only **bold** and [label](href).
 * (No markdown library needed for two rules; internal links use next/link.)
 * `term` wraps matches in <mark> for search highlighting.
 */

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function Highlight({ text, term }: { text: string; term?: string }) {
  const t = term?.trim();
  if (!t) return <>{text}</>;
  const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-co-accent-soft px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function Md({ text, term }: { text: string; term?: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-ink">
              <Highlight text={part.slice(2, -2)} term={term} />
            </strong>
          );
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          const cls = "font-semibold text-forest-text underline decoration-co-accent/50 underline-offset-2 hover:decoration-forest";
          return href!.startsWith("/") ? (
            <Link key={i} href={href!} className={cls}>
              <Highlight text={label!} term={term} />
            </Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
              <Highlight text={label!} term={term} />
            </a>
          );
        }
        return <Highlight key={i} text={part} term={term} />;
      })}
    </>
  );
}
