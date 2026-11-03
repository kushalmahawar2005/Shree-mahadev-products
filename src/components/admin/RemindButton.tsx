"use client";

import { useTransition } from "react";
import { markReminderSentAction } from "@/lib/admin-actions";

/** Opens WhatsApp with a prefilled recovery message and records that a reminder went out. */
export function RemindButton({ cartId, href, again }: { cartId: number; href: string; again: boolean }) {
  const [pending, start] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => start(() => markReminderSentAction(cartId))}
      className="inline-flex min-h-10 items-center rounded-full bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-mid aria-disabled:opacity-60"
      aria-disabled={pending}
    >
      {again ? "Remind again" : "WhatsApp"}
    </a>
  );
}
