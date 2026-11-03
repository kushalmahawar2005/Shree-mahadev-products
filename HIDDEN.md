# Hidden sections

Sections that are built but switched off for now. To show one again, flip its flag to `true`.

| Section | Where | Flag | Hidden on |
|---|---|---|---|
| Rasoi Starter Kit card (above footer) | `src/app/(site)/(shop)/page.tsx` | `SHOW_RASOI_KIT` | 2026-11-03 |
| "Beyond our Oils" slider (Our Ghani card) | `src/app/(site)/(shop)/page.tsx` | `SHOW_BEYOND_OILS` | 2026-11-03 |
| Placeholder review cards ("A verified customer review will appear here.") under Spotlight. Real reviews in `src/data/home.ts` `endorsements` still show. | `src/components/home/PicksSections.tsx` → `Endorsements()` | `SHOW_REVIEW_PLACEHOLDERS` | 2026-11-03 |
