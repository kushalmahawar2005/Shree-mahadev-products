"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/db";

const customerDetailsSchema = z
  .object({
    customerId: z.number().int().positive(),
    notes: z.string().trim().max(10000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .strict();

export async function saveCustomerDetailsAction(input: unknown) {
  const admin = await requireAdmin();
  const parsed = customerDetailsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Check the notes and tags, then try again." };

  const { customerId, notes, tags } = parsed.data;
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      "SELECT id FROM customers WHERE id=? FOR UPDATE",
      [customerId],
    );
    if (!Array.isArray(existing) || existing.length === 0)
      throw new Error("Customer not found.");
    await conn.execute("UPDATE customers SET notes=?, tags=? WHERE id=?", [
      notes || null,
      JSON.stringify(tags),
      customerId,
    ]);
    await conn.execute(
      "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'customer.updated', ?, ?)",
      [admin.username, `customer:${customerId}`, JSON.stringify({ tags })],
    );
    await conn.commit();
    return { ok: true };
  } catch (error) {
    await conn.rollback();
    if (error instanceof Error && error.message === "Customer not found.")
      return { ok: false, error: error.message };
    console.error("Could not save customer details", error);
    return { ok: false, error: "Could not save customer details." };
  } finally {
    conn.release();
  }
}
