"use client";

import { useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shadcn/sheet";
import { AddressForm } from "./AddressForm";
import type { AddressView } from "./schema";

/* Desktop (≥1024px) = centred dialog; phones and tablets = bottom sheet. */
const QUERY = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useDesktop = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );

export function AddressDialog({
  open,
  onOpenChange,
  address,
  isFirst,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = editing that address. */
  address?: AddressView;
  isFirst: boolean;
}) {
  const desktop = useDesktop();
  const title = address ? "Edit address" : "Add a new address";
  const text = "Start with the pincode: we'll fill in the city and state.";
  // Remount per address so the form starts from the right values.
  const form = (
    <AddressForm
      key={address?.id ?? "new"}
      initial={address}
      isFirst={isFirst}
      onDone={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    />
  );

  if (desktop)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="co-theme max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-ink">{title}</DialogTitle>
            <DialogDescription className="text-ink-muted">{text}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="co-theme max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl bg-white px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <span aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
        <SheetHeader className="px-0 pb-4">
          <SheetTitle className="text-xl text-ink">{title}</SheetTitle>
          <SheetDescription className="text-ink-muted">{text}</SheetDescription>
        </SheetHeader>
        {form}
      </SheetContent>
    </Sheet>
  );
}
