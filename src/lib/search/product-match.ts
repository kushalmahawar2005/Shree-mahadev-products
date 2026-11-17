/**
 * Product search matching shared by the search page (server) and the header search box (client).
 * Handles what shoppers actually type: Hinglish / Hindi names ("sarson", "सरसों", "moongfali"),
 * small typos ("musturd", "honay"), and ranks title hits above description/tag hits.
 * Pure and dependency-free so it can run in the browser.
 */

/** Local / Hindi words → the English words used in product titles and tags. */
const SYNONYMS: Record<string, string[]> = {
  sarson: ["mustard"], sarso: ["mustard"], sarsoon: ["mustard"], sarsun: ["mustard"], rai: ["mustard"],
  सरसों: ["mustard"], सरसो: ["mustard"], राई: ["mustard"],
  peeli: ["yellow"], pili: ["yellow"], पीली: ["yellow"], kali: ["black"], kaali: ["black"], काली: ["black"],
  moongfali: ["groundnut", "peanut"], mungfali: ["groundnut", "peanut"], mungphali: ["groundnut", "peanut"], moongphali: ["groundnut", "peanut"],
  peanut: ["groundnut"], मूंगफली: ["groundnut"], मूँगफली: ["groundnut"],
  til: ["sesame"], teel: ["sesame"], gingelly: ["sesame"], तिल: ["sesame"],
  nariyal: ["coconut"], nariyel: ["coconut"], copra: ["coconut"], नारियल: ["coconut"],
  alsi: ["flaxseed"], alsee: ["flaxseed"], linseed: ["flaxseed"], flax: ["flaxseed"], अलसी: ["flaxseed"],
  arandi: ["castor"], arandee: ["castor"], अरंडी: ["castor"],
  surajmukhi: ["sunflower"], suryamukhi: ["sunflower"], सूरजमुखी: ["sunflower"],
  shahad: ["honey"], shehad: ["honey"], sahad: ["honey"], madhu: ["honey"], शहद: ["honey"], मधु: ["honey"],
  khand: ["khand", "sweetener"], khaand: ["khand", "sweetener"], desi: ["deshi"], deshi: ["desi"], खांड: ["khand"], खाँड: ["khand"],
  gud: ["jaggery"], gur: ["jaggery"], गुड़: ["jaggery"], shakkar: ["sugar", "jaggery"], misri: ["mishri"],
  tel: ["oil"], tail: ["oil"], तेल: ["oil"],
  ghani: ["wood-pressed", "kachi"], kachi: ["kachi", "wood-pressed"], cold: ["cold-pressed", "wood-pressed"],
  kolhu: ["wood-pressed"], lakdi: ["wood-pressed"],
};

/** Common filler words that shouldn't have to match ("oil for cooking", "ka tel"). */
const STOP = new Set(["ka", "ki", "ke", "for", "the", "and", "aur", "with", "me", "mein", "wala", "wali", "of", "a"]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Levenshtein distance with an early exit once it exceeds `max`. */
function within(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Typos allowed for a query word: none for short words, 1 for 4-6 letters, 2 for longer. */
const allowedTypos = (w: string) => (w.length < 4 ? 0 : w.length <= 6 ? 1 : 2);

export type SearchFields = { title: string; titleHi?: string | null; extra?: string };

/**
 * Score a product for a query: 0 = no match. Every meaningful query word must match the product
 * (directly, through a synonym, or within a small typo); title matches weigh more than the rest.
 */
export function scoreProduct(query: string, p: SearchFields): number {
  const words = norm(query).split(" ").filter((w) => w && !STOP.has(w));
  if (!words.length) return 0;
  const title = norm(`${p.title} ${p.titleHi ?? ""}`);
  const rest = norm(p.extra ?? "");
  const titleWords = title.split(" ");
  const restWords = rest.split(" ");
  let score = 0;
  for (const w of words) {
    const options = [w, ...(SYNONYMS[w] ?? [])];
    let best = 0;
    for (const o of options) {
      if (title.includes(o)) best = Math.max(best, o === w ? 10 : 8);
      else if (rest.includes(o)) best = Math.max(best, o === w ? 4 : 3);
    }
    if (!best) {
      const typos = allowedTypos(w);
      if (typos && titleWords.some((t) => within(w, t, typos))) best = 6;
      else if (typos && restWords.some((t) => t.length > 3 && within(w, t, typos))) best = 2;
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

/** Filter + rank (best first, original order on ties). */
export function rankProducts<T>(query: string, items: T[], fields: (item: T) => SearchFields): T[] {
  return items
    .map((item, i) => ({ item, i, s: scoreProduct(query, fields(item)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}
