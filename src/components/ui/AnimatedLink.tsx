import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Text link with a 1px underline that grows from the left on hover/active and leaves to the right. */
export function AnimatedLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link className={cn("link-underline", className)} {...props} />;
}
