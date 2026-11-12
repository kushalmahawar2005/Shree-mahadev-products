import { cn } from "@/lib/utils/cn";

/** One left-aligned section header for the storefront: Hindi eyebrow (accent), display title, optional action. */
export function SectionHeader({
  eyebrow,
  title,
  action,
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-3 md:mb-10", className)}>
      <div>
        {eyebrow && (
          <p className="font-hindi text-base text-co-accent-ink md:text-lg" lang="hi">
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="mt-1 text-[28px] leading-[1.1] tracking-[-0.02em] text-ink md:text-[40px]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Same container + vertical rhythm for every storefront section (no background bands). */
export const sectionClass = "mx-auto max-w-7xl px-6 py-14 md:px-8 md:py-20";
