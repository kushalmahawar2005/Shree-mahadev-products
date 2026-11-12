import { cn } from "@/lib/utils/cn";

/** Three bouncing dots for button loading states (keyframes in globals.css). */
export function LoadingDots({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("loading-dots inline-flex h-4 items-center gap-1", className)}>
      <span />
      <span />
      <span />
    </span>
  );
}
