import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/account/ui";

/** Wrong id, or an order that belongs to someone else (same answer, so ids can't be probed). */
export default function OrderNotFound() {
  return (
    <EmptyState
      icon={PackageSearch}
      title="Order not found"
      text="We couldn't find this order in your account. Check the link, or find it in your orders list."
    >
      <Link
        href="/account/orders"
        className="inline-flex h-11 items-center rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid"
      >
        Go to my orders
      </Link>
    </EmptyState>
  );
}
