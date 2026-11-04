import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";
import { INQUIRY_STATUSES, type Inquiry, type InquiryStatus } from "@/lib/inquiry-types";
export { INQUIRY_STATUSES, type Inquiry, type InquiryStatus };

type Rows = RowDataPacket[];

export async function listInquiries(): Promise<Inquiry[]> {
  const [rows] = await db().query<Rows>(
    `SELECT id, name, business, city, phone, email, product, quantity, message, status, assignee,
       DATE_FORMAT(follow_up_at, '%Y-%m-%d') AS follow_up_at, quote_amount, created_at
     FROM inquiries WHERE kind='bulk'
     ORDER BY FIELD(status,'new','contacted','quoted','won','lost'),
       follow_up_at IS NULL, follow_up_at ASC, created_at DESC LIMIT 500`,
  );
  if (!rows.length) return [];
  const ids = rows.map((row) => Number(row.id));
  const [notes] = await db().query<Rows>(
    "SELECT id, inquiry_id, author, body, created_at FROM inquiry_notes WHERE inquiry_id IN (?) ORDER BY created_at, id",
    [ids],
  );
  const byInquiry = new Map<number, Inquiry["notes"]>();
  for (const note of notes) {
    const id = Number(note.inquiry_id);
    const list = byInquiry.get(id) ?? [];
    list.push({
      id: Number(note.id),
      author: String(note.author),
      body: String(note.body),
      createdAt: String(note.created_at),
    });
    byInquiry.set(id, list);
  }
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    business: String(row.business ?? ""),
    city: String(row.city ?? ""),
    phone: String(row.phone),
    email: String(row.email ?? ""),
    product: String(row.product ?? ""),
    quantity: String(row.quantity ?? ""),
    message: String(row.message ?? ""),
    status: row.status as InquiryStatus,
    assignee: String(row.assignee ?? ""),
    followUpAt: String(row.follow_up_at ?? ""),
    quoteAmount: row.quote_amount === null ? null : Number(row.quote_amount),
    createdAt: String(row.created_at),
    notes: byInquiry.get(Number(row.id)) ?? [],
  }));
}
