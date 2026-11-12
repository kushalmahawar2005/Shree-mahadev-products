import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/layout/icons";
import { buttonClass, LinkButton } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { plannedCombos } from "@/data/collections";
import { shopByUse, site, whatsappLink } from "@/data/site";
import type { ContentEntry } from "@/content";

export function ProofBand() {
  const items = [
    {
      title: "Lab reports you can read",
      text: "Each oil is tested by an independent lab. Reports are on our lab reports page.",
      todo: "lab report PDFs per product",
    },
    {
      title: "FSSAI licensed",
      text: `Licence no. ${site.fssai}.`,
      todo: "FSSAI licence number",
    },
    {
      title: "Batch testing",
      text: "Every batch is checked before it is bottled.",
      todo: "confirm batch testing process",
    },
  ];
  return (
    <section className="bg-forest-deep py-14 text-white md:py-20">
      <Container>
        <Reveal>
          <h2 className="text-3xl text-white md:text-4xl">
            Good oil, backed by proof
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-white/80">
            We would rather show you than tell you.
          </p>
        </Reveal>
        <Stagger variant="linear" className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((it) => (
            <StaggerItem
              key={it.title}
              className="rounded-[var(--radius-card)] bg-white/5 p-6 ring-1 ring-white/10"
            >
              <span
                aria-hidden
                className="mb-4 block size-10 rounded-full bg-mustard/90"
              />
              <h3 className="text-2xl text-white">{it.title}</h3>
              <p className="mt-2 text-white/80">{it.text}</p>
              <p className="mt-3 text-sm text-khaki">TODO(client): {it.todo}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-10">
          <LinkButton href="/lab-reports" variant="light">
            See lab reports
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}

export function ShopByUse() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <Reveal>
          <SectionHeading
            title="Shop by use"
            intro="Not sure which oil? Start with what you are cooking."
          />
        </Reveal>
        <Stagger
          as="ul"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {shopByUse.map((u) => (
            <StaggerItem as="li" key={u.tag}>
              <Link
                href={`/shop?use=${u.tag}`}
                className="flex h-full min-h-28 flex-col justify-between rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors duration-200 hover:border-forest hover:bg-khaki-soft"
              >
                <span className="font-display text-xl text-forest-text">
                  {u.label}
                </span>
                <span className="mt-2 text-sm text-ink-muted">{u.note}</span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

export function Combos() {
  return (
    <section className="bg-khaki-soft py-14 md:py-20">
      <Container>
        <Reveal>
          <SectionHeading
            title="Rasoi kits"
            intro="Everything a kitchen needs, packed together."
          />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2">
          {plannedCombos.map((c) => (
            <Reveal
              key={c.title}
              className="rounded-[var(--radius-card)] bg-white p-6 md:p-8"
            >
              <h3 className="text-2xl">{c.title}</h3>
              <ul className="mt-3 space-y-1 text-ink-muted">
                {c.items.map((i) => (
                  <li key={i}>· {i}</li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-sale">{c.note}</p>
              <a
                href={whatsappLink(`Hi, I'm interested in the ${c.title}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("secondary", "md", "mt-5")}
              >
                Ask on WhatsApp
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FounderNote() {
  return (
    <section className="py-14 md:py-20">
      <Container className="grid items-center gap-10 md:grid-cols-[2fr_3fr]">
        <Reveal>
          <SmartImage
            src="/images/founder-placeholder.svg"
            alt="Founder of Swadeshi Mahadev Products"
            width={800}
            height={1000}
            className="aspect-[4/5] w-full max-w-sm rounded-[var(--radius-card)] object-cover"
          />
        </Reveal>
        <Reveal className="max-w-xl">
          <h2 className="text-3xl md:text-4xl">A note from our ghani</h2>
          <blockquote className="mt-5 space-y-4 text-lg">
            <p>
              TODO(client): 3–4 lines in the founder&apos;s own words. Why they
              started, what their family cooked with, and what they will never
              compromise on.
            </p>
          </blockquote>
          <p className="mt-6 font-display text-2xl text-forest-text">
            TODO(client): founder name
          </p>
          <p className="text-ink-muted">
            Founder, Swadeshi Mahadev Products, Bijainagar
          </p>
          <Link
            href="/about"
            className="mt-5 inline-block font-semibold text-forest underline underline-offset-4"
          >
            Read our story
          </Link>
        </Reveal>
      </Container>
    </section>
  );
}

export function BulkBand() {
  return (
    <section className="py-14 md:py-20">
      <Container>
        <Reveal className="flex flex-col items-start gap-6 rounded-[var(--radius-card)] bg-forest p-8 text-white md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-3xl text-white md:text-4xl">
              Restaurant or store? Order 15L tins
            </h2>
            <p className="mt-3 max-w-xl text-lg text-white/80">
              Bulk 5L and 15L tins for restaurants, caterers and retailers. Tell
              us what you need and we will reply on WhatsApp.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={whatsappLink("Hi, I'd like a bulk order quote.")}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("light", "lg")}
            >
              <WhatsAppIcon className="size-5" /> Order on WhatsApp
            </a>
            <Link
              href="/bulk-orders"
              className={buttonClass(
                "ghost",
                "lg",
                "text-white hover:bg-white/10",
              )}
            >
              Bulk order form
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function StoriesRow({
  items,
}: {
  items: (ContentEntry & { kind: "recipes" | "journal" })[];
}) {
  if (!items.length) return null;
  return (
    <section className="pb-16 md:pb-24">
      <Container>
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl md:text-4xl">From our kitchen</h2>
          <div className="flex gap-4 font-semibold text-forest">
            <Link href="/recipes" className="underline underline-offset-4">
              All recipes
            </Link>
            <Link href="/journal" className="underline underline-offset-4">
              Journal
            </Link>
          </div>
        </Reveal>
        <Stagger className="grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <StaggerItem key={`${it.kind}/${it.slug}`}>
              <StoryCard entry={it} />
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

export function StoryCard({
  entry,
}: {
  entry: ContentEntry & { kind: "recipes" | "journal" };
}) {
  return (
    <Link href={`/${entry.kind}/${entry.slug}`} className="group block">
      <div
        className="aspect-[4/3] overflow-hidden rounded-[var(--radius-card)]"
        style={{ backgroundColor: entry.color ?? "#F6EFE2" }}
      >
        <div className="grid size-full place-items-center transition-transform duration-500 group-hover:scale-[1.04]">
          <span className="font-display text-3xl text-forest-deep/70">
            {entry.kind === "recipes" ? "Recipe" : "Journal"}
          </span>
        </div>
      </div>
      <h3 className="mt-4 text-2xl group-hover:underline">{entry.title}</h3>
      <p className="mt-1 text-ink-muted">{entry.description}</p>
    </Link>
  );
}
