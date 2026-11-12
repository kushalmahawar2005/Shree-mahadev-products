/**
 * Display formatting for customer data. The database keeps exactly what was typed; these only
 * change how it is shown ("bhawar badi" → "Bhawar Badi").
 */
const SMALL = new Set(["and", "of", "the", "near", "opp", "opp.", "via"]);

export function formatName(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  return t
    .split(" ")
    .map((w, i) => {
      if (!w || /\d/.test(w) || w.includes("@")) return w; // "12B", emails stay as typed
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w
        .split(/([-/.])/)
        .map((part) =>
          /^[a-zÀ-ɏ]/i.test(part)
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part,
        )
        .join("");
    })
    .join(" ");
}

export type AddressLike = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

/** "Bhawar Badi, Bijainagar, Rajasthan 305624": Title Case, tidy commas, no repeated city/state. */
export function formatAddress(a: AddressLike): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const push = (v?: string | null) => {
    for (const piece of (v ?? "").split(",")) {
      const p = formatName(piece);
      const key = p.toLowerCase();
      if (p && !seen.has(key)) {
        seen.add(key);
        parts.push(p);
      }
    }
  };
  push(a.line1);
  push(a.line2);
  push(a.city);
  const state = formatName(a.state);
  const tail = [seen.has(state.toLowerCase()) ? "" : state, a.pincode ?? ""]
    .filter(Boolean)
    .join(" ");
  return [...parts, tail].filter(Boolean).join(", ");
}

/** "6367828788" → "+91 63678 28788" */
export function formatPhone(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : (raw ?? "");
}

/** DB timestamps are IST wall-clock strings ("2026-11-12 17:40:00"). → "12 Nov 2026, 5:40 PM" */
export function formatDateTime(
  raw: string | Date,
  opts: { time?: boolean } = { time: true },
): string {
  const d =
    typeof raw === "string"
      ? new Date(
          `${raw.replace(" ", "T")}${/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? "" : "+05:30"}`,
        )
      : raw;
  if (Number.isNaN(d.getTime())) return String(raw);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.time ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  })
    .format(d)
    .replace(" am", " AM")
    .replace(" pm", " PM");
}

export const initials = (name: string) =>
  formatName(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
