import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/money";
import type { Money } from "@/lib/commerce/types";

export function Badge({
  children,
  tone = "mustard",
  className,
}: {
  children: React.ReactNode;
  tone?: "mustard" | "forest" | "soft";
  className?: string;
}) {
  const tones = {
    mustard: "bg-mustard text-white",
    forest: "bg-forest text-white",
    soft: "bg-khaki-soft text-forest-text",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Pill({
  children,
  active,
  disabled,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors duration-200",
        active
          ? "border-forest bg-forest text-white"
          : "border-line bg-white text-forest-text hover:border-forest",
        disabled && "cursor-not-allowed border-dashed text-ink-muted line-through decoration-1 hover:border-line",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-full border border-line bg-white px-5 text-base text-ink placeholder:text-ink-muted focus:border-forest focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Rating({
  rating,
  count,
  className,
  size = "sm",
}: {
  rating?: number;
  count?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!rating || !count) return null;
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  const star = size === "md" ? "size-5" : "size-4";
  return (
    <div className={cn("flex items-center gap-1.5 text-sm text-ink-muted", className)}>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex text-line">{stars(star)}</span>
        <span className="absolute inset-0 flex overflow-hidden text-mustard" style={{ width: `${pct}%` }}>
          {stars(star)}
        </span>
      </span>
      <span>
        <span className="sr-only">Rated </span>
        {rating.toFixed(1)}
        <span className="sr-only"> out of 5,</span> ({count}
        <span className="sr-only"> reviews</span>)
      </span>
    </div>
  );
}

function stars(cls: string) {
  return Array.from({ length: 5 }, (_, i) => (
    <svg key={i} viewBox="0 0 20 20" className={cn(cls, "shrink-0")} fill="currentColor">
      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
    </svg>
  ));
}

export function Price({
  price,
  compareAt,
  from,
  className,
  size = "md",
}: {
  price: Money;
  compareAt?: Money;
  from?: boolean;
  className?: string;
  size?: "md" | "lg";
}) {
  if (!price.amount) {
    return <span className={cn("text-sm font-semibold text-ink-muted", className)}>Price coming soon</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-bold text-forest-text", size === "lg" ? "text-2xl" : "text-lg")}>
        {from && <span className="mr-1 text-sm font-semibold text-ink-muted">From</span>}
        {formatMoney(price)}
      </span>
      {compareAt && compareAt.amount > price.amount && (
        <s className="text-sm text-ink-muted">
          <span className="sr-only">MRP </span>
          {formatMoney(compareAt)}
        </s>
      )}
    </span>
  );
}

export function SwatchDot({ color, className }: { color?: string; className?: string }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function SectionHeading({
  title,
  intro,
  className,
  align = "left",
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-8 max-w-2xl md:mb-10", align === "center" && "mx-auto text-center", className)}>
      <h2 className="text-3xl md:text-4xl">{title}</h2>
      {intro && <p className="mt-3 text-lg text-ink-muted">{intro}</p>}
    </div>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-khaki-soft px-1.5 py-0.5 font-mono text-sm text-sale">TODO(client): {children}</span>
  );
}
