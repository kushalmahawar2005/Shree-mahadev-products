import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import {
  CUSTOMER_FILTERS,
  exportCustomers,
  type CustomerFilter,
} from "@/lib/server/customers";
import { db } from "@/lib/server/db";

const querySchema = z
  .object({
    q: z.string().trim().max(80).default(""),
    f: z.enum(CUSTOMER_FILTERS).default("all"),
  })
  .strict();

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    q: params.get("q") ?? "",
    f: params.get("f") ?? "all",
  });
  if (!parsed.success)
    return new Response("Invalid export filters", { status: 400 });

  try {
    const filters = {
      q: parsed.data.q,
      filter: parsed.data.f as CustomerFilter,
    };
    const rows = await exportCustomers(filters);
    await db().execute(
      "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'customers.exported', 'customers', ?)",
      [
        admin.username,
        JSON.stringify({
          filter: filters.filter,
          search: filters.q || null,
          rowCount: rows.length,
        }),
      ],
    );
    const csv = [
      [
        "name",
        "phone",
        "email",
        "city",
        "state",
        "orders",
        "LTV",
        "last order",
      ],
      ...rows,
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    return new Response(`\uFEFF${csv}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="customers.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Customer CSV export failed", error);
    return new Response("Could not export customers", { status: 500 });
  }
}
