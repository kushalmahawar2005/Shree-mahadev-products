"use client";

import { unwrap } from "@/lib/action-result";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importStarterCatalogAction } from "@/lib/catalog-actions";

export function ImportCatalogButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-dashed border-forest/40 bg-khaki-soft/50 p-6 text-center">
      <p className="font-semibold text-forest-text">The catalog is empty.</p>
      <p className="mt-1 text-sm text-ink-muted">Import the starter list (all oils, honey and sweeteners with current prices), then edit from here.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              unwrap(await importStarterCatalogAction());
              router.refresh();
            } catch (e) {
              setErr((e as Error).message);
            }
          })
        }
        className="mt-4 min-h-11 rounded-full bg-forest px-6 font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import starter catalog"}
      </button>
      {err && <p className="mt-2 text-sm text-sale">{err}</p>}
    </div>
  );
}
