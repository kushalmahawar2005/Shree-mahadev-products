import { cn } from "@/lib/utils/cn";

/** One left-aligned section header for the storefront: Hindi eyebrow (accent), display title, optional action. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  /** One muted line under the title. */
  subtitle?: string;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div data-slot="section-header" className={cn("mb-6 flex flex-wrap items-end justify-between gap-3 md:mb-8", className)}>
      <div>
        {eyebrow && (
          <p className="font-hindi text-base text-co-accent-ink md:text-lg" lang="hi">
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="mt-1 text-[24px] leading-[1.1] tracking-[-0.02em] text-ink sm:text-[26px] md:text-[34px]">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-ink-muted md:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Same container + vertical rhythm for every storefront section (no background bands). */
export const sectionClass = "mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16";
