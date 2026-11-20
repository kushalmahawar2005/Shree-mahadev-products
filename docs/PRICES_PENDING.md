# Prices pending client confirmation

> **Resolved 2026-11-21:** the client sent a new oil price sheet. All 12 oils (56 sizes) now use its
> "% Total" column as the price and "mrp" as the strike price: migration 053 (051 wrongly used "final").
> Honey and sweetener prices were not in that sheet and are unchanged. The notes below are history.

Generated 2026-11-12 from the local MySQL catalog (`product_variants`). **No price was changed.**
The DB stays the single source of truth: prices are edited only in Admin → Products (or by
re-running `scripts/import-price-sheet.mjs` with a corrected sheet). Nothing is duplicated in
`src/data/products.ts`.

## Where the DB prices come from

`scripts/import-price-sheet.mjs` imported "Bharat Sir.xlsx" on 2026-11-10:
**Amount → selling price**, **MRP → strike price**, both `Math.round`-ed.
The sheet's columns are: `Rate → +GST 5% → +Shipping 1 → +PayU ~3% = Cost → +Shipping 2 = Amount`.

## The four figures the owner flagged

| Product | Size | DB price (sheet "Amount") | Owner's figure | Gap |
|---|---|--:|--:|--:|
| Groundnut oil | 1 L | ₹491 | ₹425 | ₹66 |
| Yellow mustard oil | 1 L | ₹572 | ₹499 | ₹73 |
| Coconut oil | 1 L | ₹1,086 | ₹900 | ₹186 |
| Almond oil | 250 ml | ₹1,032 | ₹850 | ₹182 |

The owner's numbers are all 13–17% below the DB price. That is about the size of
GST 5% + shipping + PayU fee in the sheet, so they are **most likely the sheet's pre-GST "Rate"
(or "Cost") column, not the final "Amount"**. Please ask the client which column is the
customer-facing price (GST-inclusive, shipping included or not) before changing anything.
If the client confirms the lower numbers, every size of every product moves, not just these four.

## Every product / size in the DB

"Matches sheet Amount (confirm)" = imported as-is from the sheet; still worth one look from the
client because of the question above.

| Product | Size | DB price (₹) | DB MRP (₹) | % off | Owner's catalog figure (₹) | Status |
|---|---|--:|--:|--:|--:|---|
| Jamun Raw Honey | 150 g | 247 | 282 | 12% |  | Matches sheet Amount (confirm) |
| Jamun Raw Honey | 250 g | 312 | 367 | 15% |  | Matches sheet Amount (confirm) |
| Jamun Raw Honey | 500 g | 490 | 598 | 18% |  | Matches sheet Amount (confirm) |
| Jamun Raw Honey | 1 kg | 843 | 1018 | 17% |  | Matches sheet Amount (confirm) |
| Sunderban Raw Honey | 150 g | 247 | 282 | 12% |  | Matches sheet Amount (confirm) |
| Sunderban Raw Honey | 250 g | 312 | 367 | 15% |  | Matches sheet Amount (confirm) |
| Sunderban Raw Honey | 500 g | 490 | 598 | 18% |  | Matches sheet Amount (confirm) |
| Sunderban Raw Honey | 1 kg | 843 | 1018 | 17% |  | Matches sheet Amount (confirm) |
| Van Tulsi Raw Honey | 150 g | 247 | 282 | 12% |  | Matches sheet Amount (confirm) |
| Van Tulsi Raw Honey | 250 g | 312 | 367 | 15% |  | Matches sheet Amount (confirm) |
| Van Tulsi Raw Honey | 500 g | 490 | 598 | 18% |  | Matches sheet Amount (confirm) |
| Van Tulsi Raw Honey | 1 kg | 843 | 1018 | 17% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Groundnut Oil | 500 ml | 307 | 360 | 15% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Groundnut Oil | 1 L | 491 | 599 | 18% | 425 | **Differs: needs client confirmation** |
| Wood-Pressed Groundnut Oil | 2 L | 930 | 1158 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Groundnut Oil | 5 L | 2250 | 2730 | 18% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Groundnut Oil | 15 L | 5965 | 7560 | 21% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Yellow Mustard Oil | 500 ml | 345 | 409 | 16% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Yellow Mustard Oil | 1 L | 572 | 705 | 19% | 499 | **Differs: needs client confirmation** |
| Wood-Pressed Yellow Mustard Oil | 2 L | 1082 | 1354 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Yellow Mustard Oil | 5 L | 2525 | 3088 | 18% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Yellow Mustard Oil | 15 L | 7133 | 9078 | 21% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Sunflower Oil | 500 ml | 377 | 452 | 17% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Sunflower Oil | 1 L | 632 | 782 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Sunflower Oil | 2 L | 1201 | 1509 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Sunflower Oil | 5 L | 2823 | 3475 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed White Sesame Oil | 500 ml | 402 | 484 | 17% |  | Matches sheet Amount (confirm) |
| Wood-Pressed White Sesame Oil | 1 L | 680 | 845 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed White Sesame Oil | 2 L | 1320 | 1664 | 21% |  | Matches sheet Amount (confirm) |
| Wood-Pressed White Sesame Oil | 5 L | 3147 | 3896 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Brown Sesame Oil | 500 ml | 375 | 449 | 16% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Brown Sesame Oil | 1 L | 626 | 775 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Brown Sesame Oil | 2 L | 1212 | 1523 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Brown Sesame Oil | 5 L | 2980 | 3679 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Coconut Oil | 100 ml | 215 | 241 | 11% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Coconut Oil | 250 ml | 367 | 438 | 16% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Coconut Oil | 500 ml | 610 | 754 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Coconut Oil | 1 L | 1086 | 1372 | 21% | 900 | **Differs: needs client confirmation** |
| Wood-Pressed Black Mustard Oil | 100 ml | 151 | 157 | 4% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 250 ml | 215 | 241 | 11% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 500 ml | 318 | 374 | 15% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 1 L | 513 | 627 | 18% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 2 L | 974 | 1214 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 5 L | 2358 | 2870 | 18% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Mustard Oil | 15 L | 6160 | 7813 | 21% |  | Matches sheet Amount (confirm) |
| Cold-Pressed Almond Oil | 30 ml | 248 | 283 | 12% |  | Matches sheet Amount (confirm) |
| Cold-Pressed Almond Oil | 50 ml | 318 | 375 | 15% |  | Matches sheet Amount (confirm) |
| Cold-Pressed Almond Oil | 100 ml | 486 | 593 | 18% |  | Matches sheet Amount (confirm) |
| Cold-Pressed Almond Oil | 250 ml | 1032 | 1302 | 21% | 850 | **Differs: needs client confirmation** |
| Cold-Pressed Almond Oil | 500 ml | 1897 | 2427 | 22% |  | Matches sheet Amount (confirm) |
| Cold-Pressed Almond Oil | 1 L | 3573 | 4606 | 22% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Walnut Oil | 30 ml | 250 | 287 | 13% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Walnut Oil | 50 ml | 321 | 378 | 15% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Walnut Oil | 100 ml | 456 | 554 | 18% |  | Matches sheet Amount (confirm) · stock 3 |
| Wood-Pressed Walnut Oil | 250 ml | 951 | 1197 | 21% |  | Matches sheet Amount (confirm) · stock 3 |
| Wood-Pressed Walnut Oil | 500 ml | 1735 | 2216 | 22% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Flaxseed Oil | 100 ml | 218 | 244 | 11% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Flaxseed Oil | 250 ml | 356 | 423 | 16% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Flaxseed Oil | 500 ml | 545 | 670 | 19% |  | Matches sheet Amount (confirm) · stock 1 |
| Wood-Pressed Flaxseed Oil | 1 L | 924 | 1162 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Castor Oil | 100 ml | 199 | 220 | 10% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Castor Oil | 250 ml | 312 | 367 | 15% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Castor Oil | 500 ml | 480 | 585 | 18% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Castor Oil | 1 L | 788 | 986 | 20% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 30 ml | 166 | 177 | 6% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 50 ml | 194 | 213 | 9% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 100 ml | 231 | 262 | 12% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 250 ml | 383 | 459 | 17% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 500 ml | 626 | 775 | 19% |  | Matches sheet Amount (confirm) |
| Wood-Pressed Black Sesame Oil | 1 L | 1075 | 1358 | 21% |  | Matches sheet Amount (confirm) |
| Desi Khand | 200 g | 157 | 165 | 5% |  | Matches sheet Amount (confirm) |
| Desi Khand | 500 g | 213 | 238 | 11% |  | Matches sheet Amount (confirm) |
| Desi Khand | 800 g | 264 | 304 | 13% |  | Matches sheet Amount (confirm) |
| Desi Khand | 5 kg | 1092 | 1225 | 11% |  | Matches sheet Amount (confirm) |
| Jaggery Powder | 200 g | 157 | 165 | 5% |  | Matches sheet Amount (confirm) |
| Jaggery Powder | 500 g | 213 | 238 | 11% |  | Matches sheet Amount (confirm) |
| Jaggery Powder | 800 g | 264 | 304 | 13% |  | Matches sheet Amount (confirm) |
| Jaggery Powder | 5 kg | 1092 | 1225 | 11% |  | Matches sheet Amount (confirm) |
| Jaggery Block | 1 kg | – | – | – |  | No price in DB (Coming soon) |

Notes:
- The three honeys (Jamun, Sunderban, Van Tulsi) share one "Honey" price block from the sheet;
  the client sent only one honey. TODO(client): real honey variants.
- Desi Khand and Jaggery Powder have identical rates in the sheet (likely copy-paste). TODO(client).
- Jaggery Block 1 kg is in the sheet but has no price, no stock and no photo in the DB, so the
  storefront shows it as "Coming soon" with a placeholder image.
- Rounding: the sheet has decimals; the import rounds to whole rupees. TODO(client): confirm rule.

## Copy flags (short descriptions / benefits)

Checked every product's short description, benefits and description for disease / medical
claims (cure, immunity, diabetes, heart, cholesterol, detox, heal, pain…). **None found, so no copy
was rewritten.** Lines worth a second look before launch:

| Product | Text | Why flagged | Action |
|---|---|---|---|
| Flaxseed oil | "Alsi oil, a plant source of omega-3." / benefit "Plant source of omega-3 (ALA)" | Nutrient-content claim. FSSAI (Advertising & Claims) allows "source of" only when the lab value meets the threshold. | Keep only if the lab report shows the ALA value; else change to "Use raw on salads, raita or roti." |
| Walnut oil | "Akhrot oil for wellness and skin care." | "Wellness" is vague, not a disease claim. | OK; optional: "Akhrot oil with a mild nutty taste, for drizzling and skin care." |
| Black sesame oil | "Rich, dark til oil for massage and wellness." / use "Oil pulling" | "Wellness" vague; oil pulling is a traditional use, keep it as a use, not a benefit. | OK as is. |

## Images

- **Black Sesame oil**: client has not sent the photo (only the nutrition card came). DB has no
  `product_images` rows, so the catalog now falls back to a neutral branded 4:5 placeholder
  (`public/images/placeholder-product.svg`).
- **Jaggery Block**: was broken because the product has no photo and the old fallback pointed to
  `/images/placeholder-jaggery-block.svg`, a file that does not exist (404). It now uses the same
  4:5 placeholder, and `SmartImage` swaps any failed image for that placeholder.
