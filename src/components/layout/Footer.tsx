import Image from "next/image";
import Link from "next/link";
import { footerNav, fullAddress, site, whatsappLink } from "@/data/site";

const payments = ["UPI", "Visa", "Mastercard", "RuPay", "Net banking", "COD"];

/** Matches the grass along the bottom edge of the illustration, so the bar continues it seamlessly. */
const GRASS_GREEN = "#A7AE3C";

/**
 * Two Brothers-style footer: white panel with logo · tagline + links · contact,
 * and a full-width hand-drawn harvest illustration (mustard field, ghani, bullock, honey, fort) along the bottom.
 */
export function Footer() {
  return (
    <footer className="relative bg-white text-forest-text">
      <div className="relative">
        {/* Content on white; the illustration below is pulled up so its empty white sky sits under the content. */}
        <div className="relative z-10 mx-auto grid max-w-[1180px] gap-10 px-4 pt-12 pb-8 sm:px-6 lg:grid-cols-[1fr_1.6fr_1fr] lg:gap-12 lg:px-8 lg:pt-14">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Link
              href="/"
              className="inline-flex flex-col items-center gap-2 lg:items-start"
            >
              <Image
                src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png"
                alt=""
                width={88}
                height={88}
                unoptimized
                className="size-20 lg:size-22"
              />
              <span className="font-display text-xl leading-tight text-forest-text">
                {site.name}
              </span>
            </Link>
            <p className="mt-2 text-sm text-ink-muted" lang="hi">
              स्वदेशी · Bijainagar, Rajasthan
            </p>
          </div>

          <div className="text-center">
            <p className="font-display text-xl text-forest-text md:text-2xl">
              Slow-pressed, the old way
            </p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-forest-text/85">
              Get new batches, offers and recipes straight on WhatsApp. No spam.
            </p>
            <a
              href={whatsappLink(
                "Hi, please add me to the Swadeshi Mahadev updates list.",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-4 flex min-h-12 max-w-md items-center justify-between rounded-lg border border-forest-text/25 bg-white px-4 text-sm text-ink-muted transition-colors duration-200 hover:border-forest"
            >
              Join on WhatsApp
              <svg
                viewBox="0 0 24 24"
                className="size-5 text-forest"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <div className="mt-8 grid grid-cols-3 gap-4 text-left sm:gap-6 xl:mt-6">
              <FooterCol title="Shop" links={footerNav.shop} />
              <FooterCol title="Learn" links={footerNav.learn} />
              <FooterCol title="Help" links={footerNav.help} />
            </div>

            {site.socials.length > 0 && (
              <ul className="mt-6 flex justify-center gap-5">
                {site.socials.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <address className="space-y-3 text-center text-sm not-italic text-forest-text/90 lg:text-left">
            <p className="font-semibold">{site.name}</p>
            <p>{fullAddress}</p>
            <p>
              Phone:{" "}
              <a
                href={site.phoneHref}
                className="underline-offset-2 hover:underline"
              >
                {site.phone}
              </a>{" "}
              ({site.supportHours})
            </p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${site.email}`}
                className="underline underline-offset-2"
              >
                {site.email}
              </a>
            </p>
            <p>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-forest underline underline-offset-2"
              >
                Chat on WhatsApp
              </a>
            </p>
          </address>
        </div>

        {/*
          Hand-painted harvest scene (mustard field, ghani, bullock, honey, fort). Its top ~42% is empty white
          sky: on desktop it is pulled up under the content; on smaller screens it is cropped to the scene.
        */}
        <div
          className="relative aspect-[2172/430] w-full lg:-mt-[12vw] lg:aspect-[2172/724]"
          aria-hidden
        >
          <Image
            src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735967/swadeshi-mahadev/static/images/footer-harvest.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-bottom"
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
              FSSAI Lic. No. {site.fssai} · {site.iso} · GSTIN {site.gst}
            </p>
            <p>
              © <CopyrightYear /> {site.name}. All rights reserved.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Payment methods">
            {payments.map((p) => (
              <li
                key={p}
                className="rounded-md border border-forest-deep/30 bg-white/30 px-2.5 py-1 text-xs font-semibold text-forest-deep"
              >
                {p}
              </li>
            ))}
          </ul>
          {site.socials.length === 0 && (
            <p className="text-forest-deep/70">TODO(client): social links</p>
          )}
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
      <h2 className="mb-2 font-body text-sm font-bold text-forest-text">
        {title}
      </h2>
      <ul>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-9 items-center text-[13px] xl:min-h-7 leading-tight text-forest-text/85 hover:text-forest hover:underline sm:text-sm"
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
