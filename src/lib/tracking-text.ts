/**
 * Courier scans (NimbusPost passes on Delhivery / Xpressbees / DTDC … wording) turned into one clear
 * line per step, the way shoppers expect: "Left Jaipur hub", "Reached Ajmer", "Out for delivery in
 * Bijainagar". Pure, so the track page, the account order page and the chat can all use it.
 */

/** "JAIPUR_HUB (Rajasthan)", "Jaipur_Sitapura_H (RJ)", "DEL/ABC" → "Jaipur hub", "Jaipur Sitapura", "Del". */
export function cleanLocation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw
    .replace(/\(.*?\)/g, " ") // state / codes in brackets
    .replace(/[_/|]+/g, " ")
    .replace(/\b(DC|DPC|PC|GW|IPC|ICD|SC|BRANCH|BR|FACILITY|CENTRE|CENTER|PVT|LTD)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+H$/i, " hub");
  if (!s || /^\d+$/.test(s)) return null;
  s = s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()).replace(/\bHub\b/g, "hub");
  return s.length > 40 ? `${s.slice(0, 40).trim()}…` : s;
}

const has = (text: string, re: RegExp) => re.test(text);

/**
 * One friendly line for a courier scan. `status` is our normalised shipment status (or the raw one),
 * `message` the courier's own text, `location` where it happened.
 */
export function scanLine(status: string, message: string | null | undefined, location: string | null | undefined): string {
  const where = cleanLocation(location);
  const msg = (message ?? "").trim();
  const t = `${status} ${msg}`.toLowerCase().replace(/_/g, " ");
  const at = (prefix: string) => (where ? `${prefix} ${where}` : prefix);

  if (has(t, /\bdelivered\b/) && !has(t, /un ?delivered|not delivered|out for/)) return "Delivered";
  if (has(t, /\brto\b|return(ed|ing)? to (origin|shipper|seller)/)) return at("Returning to us from");
  if (has(t, /out for delivery|ofd/)) return at("Out for delivery in");
  if (has(t, /un ?delivered|not delivered|delivery attempt|attempt(ed)? (failed|unsuccessful)|ndr|consignee|customer (not available|unavailable)|refused|door locked|address (incomplete|not found)|reschedul/)) {
    const reason = msg && !/^(ndr|undelivered|pending)$/i.test(msg)
      ? `: ${msg.replace(/^.*?(customer|consignee|address|door|refused)/i, "$1").replace(/^consignee/i, "Customer").slice(0, 80)}`
      : "";
    return `Delivery attempted${where ? ` in ${where}` : ""}${reason}`;
  }
  if (has(t, /picked( up)?|pickup (done|completed)|shipment picked/)) return at("Picked up from our warehouse in");
  if (has(t, /depart|dispatched|left|bagged.*(dispatch|out)|outscan|connected to/)) return at("Left");
  if (has(t, /arriv|reached|received at|inscan|in-scan|at destination|destination hub/)) return at("Reached");
  if (has(t, /manifest|booked|order (placed|created)|pickup (scheduled|generated|pending)|not picked/)) return "Shipment booked, waiting for pickup";
  if (has(t, /in ?transit|transit/)) return where ? `In transit via ${where}` : "In transit";
  if (msg) return msg.charAt(0).toUpperCase() + msg.slice(1, 120);
  return where ? `Update from ${where}` : status.replace(/[_-]+/g, " ");
}

/** Drops consecutive scans that say the same thing (couriers often repeat a scan several times). */
export function dedupeScans<T extends { line: string }>(events: T[]): T[] {
  return events.filter((e, i) => i === 0 || e.line !== events[i - 1].line);
}
