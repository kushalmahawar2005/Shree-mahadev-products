/**
 * Tiny "rich text" for admin product copy: paragraphs (empty line between them) and **bold**.
 * The DB keeps the About text as `<p>…</p>` (older rows may also hold `<strong>`/`<b>`, and the admin
 * once escaped `<` as `&lt;`); the admin textarea and the PDP both go through these helpers so the
 * same text looks the same everywhere.
 */

/** Stored HTML (or plain text) → the editable admin text: paragraphs split by an empty line, bold as **…**. */
export function htmlToEditableText(html: string) {
  return (html ?? "")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<\/?(?:strong|b)>/gi, "**")
    .trim();
}

/** Admin text → stored HTML: one <p> per paragraph, everything else kept as typed (escaped on render). */
export function editableTextToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<p>${x}</p>`)
    .join("");
}

/** One line → safe HTML; **like this** becomes bold. */
export function inlineRichText(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Admin text (or stored HTML) → safe paragraph HTML for the store. */
export function richTextToHtml(textOrHtml: string) {
  return htmlToEditableText(textOrHtml)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inlineRichText(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}
