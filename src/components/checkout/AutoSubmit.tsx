"use client";

import { useEffect, useRef } from "react";

/** Submits the PayU form once on mount. The visible button is the no-JS fallback. */
export function AutoSubmit({ formId }: { formId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return; // Strict Mode runs effects twice in dev
    sent.current = true;
    // Let the page settle first so nothing on our side cancels the cross-site POST.
    const t = setTimeout(
      () =>
        (document.getElementById(formId) as HTMLFormElement | null)?.submit(),
      150,
    );
    return () => {
      clearTimeout(t);
      sent.current = false;
    };
  }, [formId]);
  return null;
}
