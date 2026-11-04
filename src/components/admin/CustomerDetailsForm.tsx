"use client";

import { useState, useTransition } from "react";
import { saveCustomerDetailsAction } from "@/lib/customer-actions";
import { inputCls } from "@/components/admin/ui";

export function CustomerDetailsForm({
  customerId,
  initialNotes,
  initialTags,
}: {
  customerId: number;
  initialNotes: string;
  initialTags: string[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [tagsText, setTagsText] = useState(initialTags.join(", "));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const tags = [
        ...new Set(
          tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ];
      const result = await saveCustomerDetailsAction({
        customerId,
        notes,
        tags,
      });
      setMessage(
        result.ok
          ? "Saved."
          : (result.error ?? "Could not save customer details."),
      );
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest-text">
          Notes
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={10000}
          className={`${inputCls} min-h-28 rounded-xl py-3`}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest-text">
          Tags
        </span>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="Retailer, repeat buyer"
          className={inputCls}
        />
        <span className="mt-1 block text-sm text-ink-muted">
          Separate tags with commas.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-11 rounded-full bg-forest px-6 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save notes and tags"}
        </button>
        <span aria-live="polite" className="text-sm text-ink-muted">
          {message}
        </span>
      </div>
    </div>
  );
}
