import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/shadcn/skeleton";
import { cn } from "@/lib/utils/cn";

/* Server-safe building blocks for account pages (icons can be passed from Server Components). */

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl border border-dashed border-co-border-strong bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-co-accent-soft text-co-accent">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-lg font-bold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>}
      {children && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function CardSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-line bg-white p-5 md:p-6",
        className,
      )}
    >
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Page title block for every account route. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
      <div className="min-w-0">
        <p className="font-hindi text-base text-co-accent-ink" lang="hi">
          {eyebrow}
        </p>
        <h1 className="text-2xl text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
