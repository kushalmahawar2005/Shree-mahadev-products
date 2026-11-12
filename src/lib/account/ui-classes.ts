/* Button classes shared by Server and Client Components (plain module: a "use client" file can't export strings to the server). */
const btn =
  "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60";
export const primaryBtn = `${btn} bg-forest text-white hover:bg-forest-mid`;
export const secondaryBtn = `${btn} border border-line bg-white text-ink hover:border-co-border-strong`;
