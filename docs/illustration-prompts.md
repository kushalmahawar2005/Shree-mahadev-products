# Illustration prompts (storefront art)

All art must look like one hand made it. Always upload the sun-and-clouds image
(`static/images/deco/sky-sun-birds.webp`) as the style reference, and start every prompt with the
**base style** below. Real packs are never drawn: they are real photos placed on top in code.

**Base style (paste first, every time):**
> Indian folk watercolour illustration, soft handmade paper texture, visible brush strokes,
> warm muted palette only: mustard yellow, neem green, terracotta, soft brown, cream. Gentle,
> calm, premium, not cartoonish, no outlines in black, no text, no logos, no human faces.
> Exactly the same style as the reference image.

Save each final image as PNG in the folder shown, with the file name shown.

---

## 1. Product scenes, `public/brand/scenes/` (portrait 4:5, 2000 x 2500 px)

Every scene: **leave the centre-bottom third empty and plain** (soft ground, nothing in front),
because the real bottle/jar is placed there. Keep the main details to the left, right and top.

| File | Prompt (after the base style) |
|---|---|
| `groundnut.png` | A rural Rajasthan morning: groundnut plants with leaves on the left, a wooden kolhu ghani on the right, a small woven basket of groundnuts at the side, gentle fields and hills behind, soft sun. |
| `mustard.png` | A field of bright yellow mustard flowers behind, a bullock-driven wooden ghani far on the right, a brass lota and a small heap of mustard seeds at the side, pale morning sky. |
| `sesame.png` | Sesame plants with white-pink flowers on the left, a brass katori of sesame seeds on the right, a low clay wall and soft desert hills behind. |
| `coconut.png` | Two coconut palms leaning in from the sides, a cracked coconut and coconut leaves at the side, calm soft sky. |
| `dryfruit.png` (almond, walnut, flaxseed, castor) | A woven basket of almonds and walnuts on the left, castor leaves and flax flowers on the right, a soft cream wall behind with a small arched window. |
| `honey.png` | A quiet forest edge: wild honeycomb hanging from a branch on the left, a few bees, wild flowers on the right, soft green light. |
| `jaggery.png` | Sugarcane stalks on the left, a large iron kadhai of bubbling golden jaggery on a clay chulha on the right, a few jaggery blocks at the side, warm evening light. |

## 2. Refined vs Kachi Ghani slider, `public/brand/compare/` (landscape 16:9, 3200 x 1800 px)

Both images must have the **same framing and horizon**, so the slider line feels like one place
seen two ways. Main subject in the middle third (mobile crops the sides).

| File | Prompt (after the base style) |
|---|---|
| `refined.png` | The same composition as a modern oil refinery: tall grey steel tanks, pipes, a chimney with pale smoke, concrete ground. Use only cool greys and dull blue-grey, almost no warm colour. Cold, empty, industrial, but not scary. |
| `ghani.png` | The same composition as a village kachi ghani: a wooden kolhu ghani turned by a white bullock, golden oil pouring slowly into a brass vessel, clay pots, a neem tree, warm morning sun. Warm mustard, terracotta and neem green. |

Tip: make `ghani.png` first, then upload it with the prompt for `refined.png` and add
"same composition and horizon as this image".

## 3. Section decorations, `public/brand/deco/` (transparent background, about 1600 px wide)

Add to every prompt: **"isolated on a transparent background, no ground, no shadow box"**.

| File | Prompt (after the base style) | Goes in |
|---|---|---|
| `mustard-branch.png` | A long branch of yellow mustard flowers bending in from the top-left corner. | Shop by category |
| `matka.png` | A clay matka with a small brass lota beside it. | Shop by category |
| `rasoi-set.png` | A brass kadhai, a small chimta and three katoris of haldi, jeera and mustard seeds, arranged loosely. | Shop by use |
| `toran.png` | A long festive toran of mango leaves and marigold flowers, hanging in gentle curves, very wide. | Proof (lab reports) |
| `ghani-sketch.png` | A small wooden kolhu ghani with oil drops, light and sketchy. | Reels |
| `marigolds.png` | A small cluster of orange and yellow marigold flowers with leaves. | Reviews |
| `rangoli.png` | Half of a soft round rangoli mandala in mustard, terracotta and cream, very light. | Reviews (behind the 4.8 card) |
| `birds.png` | Two small flying birds like the reference. | Small gaps |

## 4. Pack photos, `public/brand/packs/` (transparent PNG)

Front photo of the size shown first on cards, background removed (remove.bg or Photoshop), named
by product handle: `groundnut-oil.png`, `yellow-mustard-oil.png`, `black-mustard-oil.png`,
`sunflower-oil.png`, `white-sesame-oil.png`, `brown-sesame-oil.png`, `black-sesame-oil.png`,
`coconut-oil.png`, `almond-oil.png`, `walnut-oil.png`, `flaxseed-oil.png`, `castor-oil.png`,
`jamun-raw-honey.png`, `sunderban-raw-honey.png`, `van-tulsi-raw-honey.png`, `desi-khand.png`,
`jaggery-powder.png`.

## Checklist before sending an image

- Same style as the sun-and-clouds reference (put them side by side).
- No text, no logo, no faces, no extra bottles drawn in.
- Centre-bottom empty (scenes only).
- Colours stay in the palette: nothing neon, no pure black.
