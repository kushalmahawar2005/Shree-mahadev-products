import { requireRole } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/db";
import { Card, PageHeader, Table } from "@/components/admin/ui";
import type { RowDataPacket } from "mysql2/promise";

export const metadata = { title: "Activity log" };
export const instant = false;

export default async function ActivityPage() {
  await requireRole("owner");
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT admin_username, action, target, meta, created_at FROM activity_log ORDER BY id DESC LIMIT 200",
  );
  return <><PageHeader title="Activity log" intro="Admin mutations and exports." /><Card><Table head={["Admin", "Action", "Target", "Details", "Time"]}>{rows.map((row, index) => <tr key={index}><td>{String(row.admin_username)}</td><td>{String(row.action)}</td><td>{row.target ? String(row.target) : "—"}</td><td className="max-w-80 truncate">{row.meta ? String(row.meta) : "—"}</td><td className="whitespace-nowrap">{String(row.created_at)}</td></tr>)}</Table></Card></>;
}
