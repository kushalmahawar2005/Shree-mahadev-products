// Hand-painted brand art (folk watercolour, 2026-11-11). Sources live in public/brand/ and are
// served from Cloudinary (static/brand/…) so next/image can resize them. Prompts and the style
// rules for new pieces: docs/illustration-prompts.md.
const CLD = "https://res.cloudinary.com/bmqxsylj/image/upload";

export type Art = { src: string; width: number; height: number };
const art = (path: string, width: number, height: number): Art => ({ src: `${CLD}/${path}`, width, height });

/** Scenes behind a product (portrait 4:5, centre-bottom left empty for the pack). */
export const scenes = {
  groundnut: art("v1794397467/swadeshi-mahadev/static/brand/scenes/groundnut.webp", 1122, 1402),
  mustard: art("v1794397471/swadeshi-mahadev/static/brand/scenes/mustard.webp", 1122, 1402),
  sesame: art("v1794397472/swadeshi-mahadev/static/brand/scenes/sesame.webp", 1122, 1402),
  coconut: art("v1794397464/swadeshi-mahadev/static/brand/scenes/coconut.webp", 1122, 1402),
  dryfruit: art("v1794397465/swadeshi-mahadev/static/brand/scenes/dryfruit.webp", 1122, 1402),
  honey: art("v1794397468/swadeshi-mahadev/static/brand/scenes/honey.webp", 1122, 1402),
  oilcake: art("v1794398252/swadeshi-mahadev/static/brand/scenes/oilcake.webp", 1122, 1402),
  jaggery: art("v1794397469/swadeshi-mahadev/static/brand/scenes/jaggery.webp", 1122, 1402),
} as const;

/** Refined vs kachi ghani slider: same framing and horizon, so the divider reads as one place. */
export const compare = {
  // v2: the painted sun (a white disc top-left on narrow crops) painted out.
  // v3 (2026-11-20, client): high-heat refining line with its own title and step labels.
  refined: art("v1795193494/swadeshi-mahadev/static/brand/compare/refined-v3.webp", 2000, 832),
  // Phones (portrait, 2026-11-20): same scenes stacked in rows.
  refinedMobile: art("v1795193495/swadeshi-mahadev/static/brand/compare/refined-mobile.webp", 1024, 1298),
  ghaniMobile: art("v1795193496/swadeshi-mahadev/static/brand/compare/ghani-mobile.webp", 1024, 1365),
  // v3 (2026-11-19, client): our own process, seeds → cleaning → kolhu → settling → bottling.
  ghani: art("v1795195099/swadeshi-mahadev/static/brand/compare/ghani-process-official-logo.webp", 1944, 809),
} as const;

/** Styled stage photos for the category showcase (pack on stone, sunlit wall, left half empty). */
export const stages = {
  oils: art("v1794401301/swadeshi-mahadev/static/brand/stage/oils.webp", 1586, 992),
} as const;

/** Transparent decorations for section edges. */
export const deco = {
  mustardBranch: art("v1794397480/swadeshi-mahadev/static/brand/deco/mustard-branch.webp", 1918, 810),
  matka: art("v1794397478/swadeshi-mahadev/static/brand/deco/matka.webp", 1195, 1002),
  rasoiSet: art("v1794397482/swadeshi-mahadev/static/brand/deco/rasoi-set.webp", 1732, 832),
  toran: art("v1794397484/swadeshi-mahadev/static/brand/deco/toran.webp", 2148, 610),
  ghaniSketch: art("v1794397475/swadeshi-mahadev/static/brand/deco/ghani-sketch.webp", 1366, 1014),
  marigolds: art("v1794397477/swadeshi-mahadev/static/brand/deco/marigolds.webp", 1703, 881),
  birds: art("v1794397734/swadeshi-mahadev/static/brand/deco/birds.webp", 1382, 1003),
  vineDivider: art("v1794398333/swadeshi-mahadev/static/brand/deco/vine-divider.webp", 2069, 166),
  rangoli: art("v1794397481/swadeshi-mahadev/static/brand/deco/rangoli.webp", 1564, 840),
} as const;
