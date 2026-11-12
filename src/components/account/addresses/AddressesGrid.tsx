"use client";

import { MapPin, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/account/shared";
import { EmptyState } from "@/components/account/ui";
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/account/address-actions";
import { formatName } from "@/lib/utils/format";
import { AddressCard } from "./AddressCard";
import { AddressDialog } from "./AddressDialog";
import type { AddressView } from "./schema";

type Op = { type: "default"; id: number } | { type: "delete"; id: number };

function apply(list: AddressView[], op: Op): AddressView[] {
  if (op.type === "delete") return list.filter((a) => a.id !== op.id);
  return list
    .map((a) => ({ ...a, isDefault: a.id === op.id }))
    .sort((x, y) => Number(y.isDefault) - Number(x.isDefault) || y.id - x.id);
}

const DEFAULT_DELETE_MSG = (others: boolean) =>
  others
    ? "This is your default address. Set another address as default first, then delete this one."
    : "This is your only address and we use it at checkout. Add another and make it default first.";

export function AddressesGrid({
  addresses,
  max,
}: {
  addresses: AddressView[];
  max: number;
}) {
  const reduce = useReducedMotion();
  const [list, applyOp] = useOptimistic(addresses, apply);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, start] = useTransition();
  const [form, setForm] = useState<{ open: boolean; address?: AddressView }>({ open: false });
  const [toDelete, setToDelete] = useState<AddressView | null>(null);

  const atLimit = list.length >= max;
  const openNew = () => setForm({ open: true });

  const run = (op: Op, action: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setPendingId(op.id);
    start(async () => {
      applyOp(op);
      const r = await action().catch(() => ({
        ok: false,
        error: "Could not reach the server. Please try again.",
      }));
      setPendingId(null);
      // On failure the optimistic change falls away by itself once the transition ends.
      if (!r.ok) toast.error(r.error ?? "Something went wrong.");
      else toast.success(done);
    });
  };

  const askDelete = (a: AddressView) => {
    if (a.isDefault) {
      toast.error(DEFAULT_DELETE_MSG(list.length > 1));
      return;
    }
    setToDelete(a);
  };

  const dialog = (
    <AddressDialog
      open={form.open}
      onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      address={form.address}
      isFirst={list.length === 0}
    />
  );

  if (list.length === 0)
    return (
      <>
        <EmptyState
          icon={MapPin}
          title="No saved addresses yet"
          text="Save your home or work address once and checkout fills it in for you."
        >
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-6 text-sm font-semibold text-white hover:bg-forest-mid"
          >
            <Plus className="size-4" /> Add your first address
          </button>
        </EmptyState>
        {dialog}
      </>
    );

  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2 md:gap-5" aria-label="Saved addresses">
        <AnimatePresence initial={!reduce} mode="popLayout">
          {list.map((a, i) => (
            <motion.li
              key={a.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : Math.min(i, 6) * 0.05 }}
            >
              <AddressCard
                address={a}
                pending={pendingId === a.id}
                onEdit={() => setForm({ open: true, address: a })}
                onDelete={() => askDelete(a)}
                onMakeDefault={() =>
                  run(
                    { type: "default", id: a.id },
                    () => setDefaultAddressAction(a.id),
                    "Default address updated",
                  )
                }
              />
            </motion.li>
          ))}
          {!atLimit && (
            <motion.li
              key="add"
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : Math.min(list.length, 6) * 0.05 }}
            >
              <button
                type="button"
                onClick={openNew}
                className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-co-border-strong bg-white/60 p-6 text-center transition-colors hover:border-forest/50 hover:bg-white focus-visible:ring-4 focus-visible:ring-forest/10 focus-visible:outline-none"
              >
                <span className="grid size-12 place-items-center rounded-full bg-co-accent-soft text-co-accent">
                  <Plus className="size-5" />
                </span>
                <span className="text-base font-bold text-ink">Add new address</span>
                <span className="text-sm text-ink-muted">
                  {list.length} of {max} saved
                </span>
              </button>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>

      {atLimit && (
        <p className="mt-4 text-sm text-ink-muted">
          You&apos;ve saved the maximum of {max} addresses. Delete one you no longer use to add
          another.
        </p>
      )}

      {dialog}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete this address?"
        description={
          toDelete
            ? `${formatName(toDelete.name)}, ${formatName(toDelete.city)} ${toDelete.pincode} will be removed from your address book. Past orders keep their own copy.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const a = toDelete;
          if (a) run({ type: "delete", id: a.id }, () => deleteAddressAction(a.id), "Address deleted");
        }}
      />
    </>
  );
}
