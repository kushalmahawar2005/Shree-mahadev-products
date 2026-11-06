import Image from "next/image";
import { ArrowRight, FlaskConical, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { DecoBg } from "@/components/ui/DecoBg";
import Link from "next/link";
import { footerNav, site, whatsappLink } from "@/data/site";
import { getCollections } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/server/store-settings";

const payments = ["UPI", "Visa", "Mastercard", "RuPay", "Net banking", "COD"];

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
    <footer className="relative bg-[#F5EDDE] text-forest-text">
      <div className="relative">
        <div className="relative z-10 mx-auto max-w-[1240px] px-4 pt-12 sm:px-6 lg:px-8 lg:pt-16">
          {/* WhatsApp CTA card */}
          <div className="relative overflow-hidden rounded-[28px] bg-forest px-6 py-8 text-white md:flex md:items-center md:justify-between md:gap-8 md:px-10">
            <div className="relative">
              <p className="font-hindi text-lg text-[#e8c879]" lang="hi">
                स्वदेशी · धीमी घानी
              </p>
              <p className="text-2xl font-bold md:text-3xl">Slow-pressed, the old way</p>
              <p className="mt-1.5 max-w-md text-sm text-white/75">New batches, offers and recipes straight on WhatsApp. No spam.</p>
            </div>
            <a
              href={whatsappLink("Hi, please add me to the Swadeshi Mahadev updates list.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shine relative mt-5 inline-flex h-12 shrink-0 items-center gap-2.5 overflow-hidden rounded-full bg-[#e8c879] px-6 text-sm font-bold text-forest-deep transition-colors hover:bg-white md:mt-0"
            >
              <MessageCircle className="size-5" /> Join on WhatsApp <ArrowRight className="size-4" />
            </a>
          </div>

          {/* Columns */}
          <div className="grid gap-10 pt-12 pb-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr] lg:gap-8">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <Image src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png" alt="" width={64} height={64} unoptimized className="size-16" />
                <span className="text-lg leading-tight font-bold text-forest-text">{site.name}</span>
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">Wood-pressed kachi ghani oils, raw honey and desi jaggery from our family ghani in Bijainagar, Rajasthan.</p>
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
            <FooterCol title="Shop" links={shopLinks} />
            <FooterCol title="Learn" links={footerNav.learn} />
            <FooterCol title="Help" links={footerNav.help} />
            <address className="space-y-3 text-sm not-italic">
              <h2 className="mb-1 font-body text-sm font-bold text-forest-text">Get in touch</h2>
              <p className="flex gap-2.5 text-ink-muted"><MapPin className="mt-0.5 size-4 shrink-0 text-forest" />{address}</p>
              <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="flex gap-2.5 text-ink-muted hover:text-forest"><Phone className="mt-0.5 size-4 shrink-0 text-forest" /><span>{b.phone}<span className="block text-xs">{b.supportHours}</span></span></a>
              <a href={`mailto:${b.email}`} className="flex gap-2.5 break-all text-ink-muted hover:text-forest"><Mail className="mt-0.5 size-4 shrink-0 text-forest" />{b.email}</a>
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white hover:bg-forest-mid"><MessageCircle className="size-4" /> Chat on WhatsApp</a>
            </address>
          </div>
        </div>

        {/*
          Hand-painted harvest scene (mustard field, ghani, bullock, honey, fort). Its top ~42% is empty white
          sky: on desktop it is pulled up under the content; on smaller screens it is cropped to the scene.
        */}
        <div
          className="relative -mt-10 aspect-[2172/430] w-full lg:-mt-[16vw] lg:aspect-[2172/724] mix-blend-multiply"
          aria-hidden
        >
          <DecoBg
            src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735967/swadeshi-mahadev/static/images/footer-harvest.webp"
            position="center bottom"
          />
        </div>
      </div>

      <div
        className="pb-20 text-forest-deep md:pb-0"
        style={{ backgroundColor: GRASS_GREEN }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="space-y-1">
            <p>
              FSSAI Lic. No. {b.fssai}{b.iso ? ` · ${b.iso}` : ""}{b.gstin ? ` · GSTIN ${b.gstin}` : ""}
            </p>
            <p>
              © <CopyrightYear /> {site.name}. All rights reserved.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Payment methods">
            {payments.map((p) => (
              <li
                key={p}
                className="rounded-md bg-white/80 px-2.5 py-1 text-[11px] font-bold tracking-wide text-forest-deep shadow-sm"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
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
      : l.includes("you")
        ? "M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"
        : "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z";
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}
