import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { accountConfig } from "@/config/account";
import { db } from "./db";

export const ADDRESS_LABELS = ["home", "work", "other"] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export type SavedAddress = {
  id: number;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  label: AddressLabel;
  isDefault: boolean;
};

export type AddressInput = {
  name: string;
  phone: string; // 10 digits, already normalised
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  label: AddressLabel;
  makeDefault: boolean;
};

const COLS =
  "id, name, phone, line1, line2, landmark, city, state, pincode, label, is_default";

function toAddress(r: RowDataPacket): SavedAddress {
  const label = String(r.label) as AddressLabel;
  return {
    id: Number(r.id),
    name: String(r.name),
    phone: String(r.phone),
    line1: String(r.line1),
    line2: String(r.line2 ?? ""),
    landmark: String(r.landmark ?? ""),
    city: String(r.city),
    state: String(r.state),
    pincode: String(r.pincode),
    label: ADDRESS_LABELS.includes(label) ? label : "other",
    isDefault: Number(r.is_default) === 1,
  };
}

/** Default first, then newest. */
export async function listAddresses(customerId: number): Promise<SavedAddress[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT ${COLS} FROM addresses WHERE customer_id=? ORDER BY is_default DESC, id DESC`,
    [customerId],
  );
  return rows.map(toAddress);
}

/** The shopper's default address (falls back to the newest one), or null. Use on the overview. */
export async function defaultAddress(customerId: number): Promise<SavedAddress | null> {
  const [[r]] = await db().query<RowDataPacket[]>(
    `SELECT ${COLS} FROM addresses WHERE customer_id=? ORDER BY is_default DESC, id DESC LIMIT 1`,
    [customerId],
  );
  return r ? toAddress(r) : null;
}

export class AddressError extends Error {}

async function inTx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ── Duplicate guard ── */

type AddressKeyInput = { phone: string; line1: string; line2?: string | null; pincode: string };

/**
 * Two addresses are the same when pincode, phone (last 10 digits) and street text match,
 * ignoring case, spaces and punctuation ("Bhawar Badi, Bijainagar" = "bhawar badi bijainagar").
 */
export function addressKey(a: AddressKeyInput) {
  const street = `${a.line1} ${a.line2 ?? ""}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return `${a.pincode.trim()}|${a.phone.replace(/\D/g, "").slice(-10)}|${street}`;
}

/** Id of this customer's saved address matching `a` (other than `exceptId`), or null. */
export async function findDuplicateAddress(
  conn: Pick<PoolConnection, "query">,
  customerId: number,
  a: AddressKeyInput,
  exceptId?: number,
): Promise<number | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, phone, line1, line2, pincode FROM addresses WHERE customer_id=? AND pincode=?",
    [customerId, a.pincode.trim()],
  );
  const key = addressKey(a);
  const hit = rows.find(
    (r) =>
      Number(r.id) !== exceptId &&
      addressKey({ phone: String(r.phone), line1: String(r.line1), line2: r.line2 as string | null, pincode: String(r.pincode) }) === key,
  );
  return hit ? Number(hit.id) : null;
}

/** Locks the customer's rows; returns [count, hasDefault]. */
async function lockBook(c: PoolConnection, customerId: number) {
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT id, is_default FROM addresses WHERE customer_id=? FOR UPDATE",
    [customerId],
  );
  return {
    ids: rows.map((r) => Number(r.id)),
    defaultId: rows.find((r) => Number(r.is_default) === 1)?.id as number | undefined,
  };
}

export async function createAddress(customerId: number, a: AddressInput) {
  return inTx(async (c) => {
    const book = await lockBook(c, customerId);
    if (book.ids.length >= accountConfig.maxAddresses)
      throw new AddressError(
        `You can save up to ${accountConfig.maxAddresses} addresses. Delete one to add another.`,
      );
    if (await findDuplicateAddress(c, customerId, a))
      throw new AddressError("This address is already saved. Edit the existing one instead.");
    // The first address (or a book without a default) always becomes the default.
    const isDefault = a.makeDefault || book.ids.length === 0 || !book.defaultId;
    if (isDefault)
      await c.execute("UPDATE addresses SET is_default=0 WHERE customer_id=?", [customerId]);
    const [res] = await c.execute<ResultSetHeader>(
      `INSERT INTO addresses (customer_id, name, phone, line1, line2, landmark, city, state, pincode, label, is_default)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        customerId,
        a.name,
        a.phone,
        a.line1,
        a.line2 || null,
        a.landmark || null,
        a.city,
        a.state,
        a.pincode,
        a.label,
        isDefault ? 1 : 0,
      ],
    );
    return res.insertId;
  });
}

export async function updateAddress(customerId: number, id: number, a: AddressInput) {
  return inTx(async (c) => {
    const book = await lockBook(c, customerId);
    if (!book.ids.includes(id)) throw new AddressError("Address not found.");
    if (await findDuplicateAddress(c, customerId, a, id))
      throw new AddressError("You already have this address saved.");
    if (a.makeDefault)
      await c.execute("UPDATE addresses SET is_default=0 WHERE customer_id=? AND id<>?", [
        customerId,
        id,
      ]);
    // Unticking "default" on the default address is ignored: a book always keeps one default.
    await c.execute(
      `UPDATE addresses SET name=?, phone=?, line1=?, line2=?, landmark=?, city=?, state=?, pincode=?, label=?,
         is_default = IF(?, 1, is_default)
       WHERE id=? AND customer_id=?`,
      [
        a.name,
        a.phone,
        a.line1,
        a.line2 || null,
        a.landmark || null,
        a.city,
        a.state,
        a.pincode,
        a.label,
        a.makeDefault ? 1 : 0,
        id,
        customerId,
      ],
    );
  });
}

export async function setDefaultAddress(customerId: number, id: number) {
  return inTx(async (c) => {
    const book = await lockBook(c, customerId);
    if (!book.ids.includes(id)) throw new AddressError("Address not found.");
    await c.execute(
      "UPDATE addresses SET is_default = (id = ?) WHERE customer_id=?",
      [id, customerId],
    );
  });
}

/** Non-default addresses only: the default must be swapped first so checkout always has one. */
export async function deleteAddress(customerId: number, id: number) {
  return inTx(async (c) => {
    const book = await lockBook(c, customerId);
    if (!book.ids.includes(id)) throw new AddressError("Address not found.");
    if (Number(book.defaultId) === id)
      throw new AddressError(
        book.ids.length > 1
          ? "This is your default address. Set another address as default first, then delete this one."
          : "This is your only address and we use it at checkout. Add another address and make it default first.",
      );
    await c.execute("DELETE FROM addresses WHERE id=? AND customer_id=?", [id, customerId]);
  });
}
