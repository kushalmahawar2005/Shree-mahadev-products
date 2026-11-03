"use client";

import { useEffect } from "react";

/** Submits the PayU form once on mount. The visible button is the no-JS fallback. */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    form?.submit();
  }, [formId]);
  return null;
}
