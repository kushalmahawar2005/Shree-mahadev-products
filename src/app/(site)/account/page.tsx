import { connection } from "next/server";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { AccountWorkspace } from "@/components/customer/AccountWorkspace";

export const metadata = { title: "My account" };
export const instant = false;

export default async function AccountPage() {
  await connection();
  const customer = await getCustomerSession();
  if (!customer) return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="mb-6 text-3xl font-semibold">My account</h1><AccountWorkspace /></main>;
  const [orders] = await db().query<import("mysql2/promise").RowDataPacket[]>("SELECT id, order_no, status, total, created_at FROM orders WHERE customer_id=? ORDER BY id DESC LIMIT 50", [customer.id]);
  const [addresses] = await db().query<import("mysql2/promise").RowDataPacket[]>("SELECT name, phone, line1, city, state, pincode FROM addresses WHERE customer_id=? ORDER BY id DESC", [customer.id]);
  return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="mb-6 text-3xl font-semibold">My account</h1><AccountWorkspace customer={customer} orders={orders.map((row) => ({ id: Number(row.id), orderNo: String(row.order_no), status: String(row.status), total: Number(row.total), createdAt: String(row.created_at) }))} addresses={addresses.map((row) => ({ name: String(row.name), phone: String(row.phone), line1: String(row.line1), city: String(row.city), state: String(row.state), pincode: String(row.pincode) }))} /></main>;
}
