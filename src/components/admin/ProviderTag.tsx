import { cn } from "@/lib/utils/cn";

/** Small pill telling which aggregator a courier / shipment goes through. */
export function ProviderTag({ provider, className }: { provider: "nimbuspost" | "velocity"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        provider === "velocity"
          ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30"
          : "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30",
        className,
      )}
    >
      {provider === "velocity" ? "Velocity" : "NimbusPost"}
    </span>
  );
}
