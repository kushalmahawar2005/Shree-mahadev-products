import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { FlaskConical, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "@/components/icons/duo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { FooterHarvestArt } from "./FooterHarvestArt";
import { PaymentLogos } from "./PaymentLogos";
import Link from "next/link";
import { footerNav, site, whatsappLink } from "@/data/site";
import { getCollections } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/server/store-settings";

/** Matches the grass along the bottom edge of the illustration, so the bar continues it seamlessly. */
const GRASS_GREEN = "#A7AE3C";

/**
 * Two Brothers-style footer: white panel with logo · tagline + links · contact,
 * and a full-width hand-drawn harvest illustration (mustard field, ghani, bullock, honey, fort) along the bottom.
 */
export async function Footer() {
  const [st, collections] = await Promise.all([getStoreSettings(), getCollections()]);
  const b = st.business;
  const socials = st.socials;
  const address = [b.addressLine1, `${b.city} ${b.postalCode}`, b.district && `Dist. ${b.district}`, b.state].filter(Boolean).join(", ");
  const shopLinks = [
    { label: "All products", href: "/shop" },
    ...collections.filter((c) => c.inMenu).sort((a, b) => (a.menuOrder ?? 0) - (b.menuOrder ?? 0)).map((c) => ({ label: c.title, href: `/collections/${c.handle}` })),
  ];
  return (
    <footer className="relative bg-page text-forest-text">
      <div className="relative">
        <div className="relative z-10 mx-auto max-w-[1240px] px-4 pt-6 sm:px-6 sm:pt-12 lg:px-8 lg:pt-16">
          {/* WhatsApp CTA card */}
          <div className="relative overflow-hidden rounded-2xl bg-forest px-4 py-5 text-white sm:rounded-[28px] sm:px-6 sm:py-8 md:flex md:items-center md:justify-between md:gap-8 md:px-10">
            <div className="relative">
              <p className="font-hindi text-sm text-co-gold sm:text-lg" lang="hi">
                स्वदेशी · धीमी घाणी
              </p>
              <p className="text-lg font-bold sm:text-2xl md:text-3xl">Slow-pressed, the old way</p>
              <p className="mt-1 max-w-md text-[13px] text-white/75 sm:mt-1.5 sm:text-sm">New batches, offers and recipes straight on WhatsApp. No spam.</p>
            </div>
            <a
              href={whatsappLink("Hi, please add me to the Swadeshi Mahadev updates list.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shine relative mt-3.5 inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-co-gold px-4 text-[13px] sm:mt-5 sm:gap-2.5 sm:px-5 sm:text-sm sm:h-12 sm:px-6 font-bold text-forest-deep transition-colors hover:bg-white md:mt-0"
            >
              <MessageCircle className="size-5" /> Join on WhatsApp <ArrowRight className="size-4" />
            </a>
          </div>

          {/* Columns */}
          <div className="grid gap-6 pt-8 pb-4 sm:grid-cols-2 sm:gap-10 sm:pt-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr] lg:gap-8">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <Image src="https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png" alt="" width={64} height={64} unoptimized className="size-12 sm:size-16" />
                <span className="text-base leading-tight font-bold text-forest-text sm:text-lg">{site.name}</span>
              </Link>
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-muted sm:text-sm">Wood-pressed kachi ghani oils, raw honey and desi jaggery from our family ghani in Bijainagar, Rajasthan.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1"><ShieldCheck className="size-3.5 text-forest" /> FSSAI licensed</span>
                <Link href="/lab-reports" className="inline-flex items-center gap-1 rounded-full border border-line bg-white/70 px-2.5 py-1 hover:border-forest/40"><FlaskConical className="size-3.5 text-forest" /> Lab tested</Link>
              </div>
              {socials.length > 0 && (
                <ul className="mt-5 flex gap-2">
                  {socials.map((s) => (
                    <li key={s.href}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid size-10 place-items-center rounded-full border border-line bg-white/70 text-forest transition-colors hover:bg-forest hover:text-white">
                        <SocialIcon label={s.label} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Phone: link groups fold into an accordion. sm+: open columns. */}
            <Accordion type="single" collapsible className="border-y border-line sm:hidden">
              {[
                { title: "Shop", links: shopLinks },
                { title: "Learn", links: footerNav.learn },
                { title: "Help", links: footerNav.help },
              ].map((g) => (
                <AccordionItem key={g.title} value={g.title} className="border-line">
                  <AccordionTrigger className="py-3.5 text-[15px] font-bold text-forest-text hover:no-underline [&>svg]:text-forest">{g.title}</AccordionTrigger>
                  <AccordionContent className="grid grid-cols-2 gap-x-4 pb-3">
                    {g.links.map((l) => (
                      <Link key={l.href} href={l.href} className="flex min-h-9 items-center text-[13px] text-ink-muted hover:text-forest">
                        {l.label}
                      </Link>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <FooterCol title="Shop" links={shopLinks} className="max-sm:hidden" />
            <FooterCol title="Learn" links={footerNav.learn} className="max-sm:hidden" />
            <FooterCol title="Help" links={footerNav.help} className="max-sm:hidden" />
            <address className="space-y-2.5 text-[13px] not-italic sm:space-y-3 sm:text-sm">
              <h2 className="mb-1 font-body text-sm font-bold text-forest-text">Get in touch</h2>
              <p className="flex gap-2.5 text-ink-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-forest" />{address}</p>
              <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="flex gap-2.5 text-ink-muted hover:text-forest"><Phone className="mt-0.5 size-4 shrink-0 text-forest" /><span>{b.phone}<span className="block text-xs">{b.supportHours}</span></span></a>
              <a href={`mailto:${b.email}`} className="flex gap-2.5 break-all text-ink-muted hover:text-forest"><Mail className="mt-0.5 size-4 shrink-0 text-forest" />{b.email}</a>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white hover:bg-forest-mid"><MessageCircle className="size-4" /> Chat on WhatsApp</a>
            </address>
          </div>
        </div>

        {/*
          Hand-painted harvest scene (mustard field, ghani, bullock, honey, fort) with its SVG animation.
          Its top ~42% is empty sky, so it is pulled up under the content (never cropped: the overlay
          is pixel-matched to the full image).
        */}
        <FooterHarvestArt className="pointer-events-none -mt-[12vw] lg:-mt-[16vw]" />
      </div>

      <div
        className="pb-20 text-forest-deep md:pb-0"
        style={{ backgroundColor: GRASS_GREEN }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs sm:gap-4 sm:px-6 sm:py-5 sm:text-sm lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-1">
            <p>
              FSSAI Lic. No. {b.fssai}{b.iso ? ` · ${b.iso}` : ""}{b.gstin ? ` · GSTIN ${b.gstin}` : ""}
            </p>
            <p>
              © <CopyrightYear /> {site.name}. All rights reserved.
            </p>
          </div>
          <PaymentLogos />
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
  className,
}: {
  title: string;
  links: { label: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="mb-3 font-body text-sm font-bold text-forest-text">
        {title}
      </h2>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group inline-flex min-h-8 items-center gap-1 text-sm leading-tight text-ink-muted transition-colors hover:text-forest"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}

function SocialIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  const d = l.includes("insta")
    ? "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm5 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm5.25-1.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
    : l.includes("face")
      ? "M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8Z"
      : l.includes("whatsapp")
        ? "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88Zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z"
        : l.includes("you")
        ? "M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"
        : "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z";
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}
