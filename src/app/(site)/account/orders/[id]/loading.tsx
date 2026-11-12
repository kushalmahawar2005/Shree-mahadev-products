import { Skeleton } from "@/components/shadcn/skeleton";
import { CardSkeleton } from "@/components/account/ui";

/** Whole-page skeleton for the order detail. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading order">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-3 h-9 w-72" />
      <Skeleton className="mt-2 h-4 w-60" />
      <Skeleton className="mt-5 h-28 rounded-3xl" />
      <div className="mt-6 grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-5 lg:col-span-7">
          <CardSkeleton rows={5} />
          <CardSkeleton rows={3} />
        </div>
        <div className="space-y-5 lg:col-span-5">
          <CardSkeleton rows={5} />
          <CardSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
