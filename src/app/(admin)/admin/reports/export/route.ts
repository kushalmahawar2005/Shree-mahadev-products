import { requireAdmin } from "@/lib/server/admin-auth";
import { resolveRange } from "@/lib/server/dashboard";
import { reportRows } from "@/lib/server/reports";

function cell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try { await requireAdmin(); } catch { return new Response("Unauthorized", { status: 401 }); }
  const p = new URL(request.url).searchParams;
  const report = p.get("report") ?? "sales";
  const range = resolveRange(p.get("range") ?? undefined, p.get("from") ?? undefined, p.get("to") ?? undefined);
  const rows = await reportRows(report, range);
  const headers = rows.length ? Object.keys(rows[0]) : ["message"];
  const csv = [headers, ...(rows.length ? rows.map((row) => headers.map((header) => row[header])) : [["No data"]])].map((row) => row.map(cell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${report}-report.csv"`, "cache-control": "private, no-store" } });
}
