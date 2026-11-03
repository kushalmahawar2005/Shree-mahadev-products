import { cn } from "@/lib/utils/cn";

/**
 * Continuous horizontal ticker. Pure CSS (works without JS), pauses on hover.
 * The list is rendered twice; the second copy is aria-hidden.
 */
export function Ticker({
  items,
  duration = 40,
  className,
  itemClassName,
  separator,
}: {
  items: React.ReactNode[];
  duration?: number;
  className?: string;
  itemClassName?: string;
  separator?: React.ReactNode;
}) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <li key={i} className={cn("flex shrink-0 items-center whitespace-nowrap px-6", itemClassName)}>
          {item}
          {separator && <span className="ml-12" aria-hidden>{separator}</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("ticker overflow-hidden", className)} style={{ ["--ticker-duration" as string]: `${duration}s` }}>
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
