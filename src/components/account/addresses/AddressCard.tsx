"use client";

import { Briefcase, CircleCheck, Home, MapPin, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { formatAddress, formatName, formatPhone } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { LABEL_TEXT, type AddressView, type Label } from "./schema";

const LABEL_ICON: Record<Label, typeof Home> = { home: Home, work: Briefcase, other: MapPin };

const ACTION =
  "inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors";

export function AddressCard({
  address: a,
  pending,
  onEdit,
  onDelete,
  onMakeDefault,
}: {
  address: AddressView;
  pending?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}) {
  const Icon = LABEL_ICON[a.label];
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-3xl border bg-white p-5 shadow-co-card transition-colors md:p-6",
        a.isDefault ? "border-forest/40 ring-1 ring-forest/15" : "border-line",
        pending && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-co-accent-soft px-2.5 text-xs font-semibold text-co-accent-ink">
          <Icon className="size-3.5" />
          {LABEL_TEXT[a.label]}
        </span>
        {a.isDefault && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-co-success-soft px-2.5 text-xs font-semibold text-co-success">
            <CircleCheck className="size-3.5" />
            Default
          </span>
        )}
      </div>

      <p className="mt-3 text-base font-bold text-ink">{formatName(a.name)}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {formatAddress(a)}
      </p>
      {a.landmark && (
        <p className="mt-1 text-sm text-ink-muted">Near {formatName(a.landmark.replace(/^near\s+/i, ""))}</p>
      )}
      <p className="mt-2 mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink tabular-nums">
        <Phone className="size-3.5 text-ink-muted" />
        {formatPhone(a.phone)}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <button type="button" onClick={onEdit} className={cn(ACTION, "text-ink hover:bg-page")}>
          <Pencil className="size-4" /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={cn(ACTION, "text-co-danger hover:bg-co-danger/10")}
        >
          <Trash2 className="size-4" /> Delete
        </button>
        {!a.isDefault && (
          <button
            type="button"
            onClick={onMakeDefault}
            disabled={pending}
            className={cn(ACTION, "ml-auto text-co-accent-ink hover:bg-co-accent-soft disabled:opacity-60")}
          >
            <Star className="size-4" /> Set as default
          </button>
        )}
      </div>
    </article>
  );
}
