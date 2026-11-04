import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { hashPassword } from "./password";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function listAdminUsers() {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT id, username, role, last_login_at, created_at FROM admin_users ORDER BY username",
  );
  return rows.map((row) => ({
    id: Number(row.id), username: String(row.username), role: String(row.role),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null, createdAt: String(row.created_at),
  }));
}

export async function createAdminInvite(email: string, role: "owner" | "manager" | "staff", createdBy: string) {
  const token = randomBytes(32).toString("hex");
  await db().execute(
    "INSERT INTO admin_invites (email, role, token_hash, expires_at, created_by) VALUES (?,?,?,DATE_ADD(NOW(), INTERVAL 48 HOUR),?)",
    [email, role, hashToken(token), createdBy],
  );
  return token;
}

export async function acceptAdminInvite(token: string, username: string, password: string) {
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT id, role FROM admin_invites WHERE token_hash=? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
    [hashToken(token)],
  );
  const invite = rows[0];
  if (!invite) throw new Error("This invite is invalid or expired.");
  const passwordHash = await hashPassword(password);
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)", [username, passwordHash, invite.role]);
    await conn.execute("UPDATE admin_invites SET used_at=NOW() WHERE id=?", [invite.id]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function removeAdminUser(id: number, actor: string) {
  const [[target]] = await db().query<RowDataPacket[]>("SELECT username, role FROM admin_users WHERE id=?", [id]);
  if (!target) throw new Error("Admin user not found.");
  if (target.username === actor) throw new Error("You cannot remove your own account.");
  if (target.role === "owner") {
    const [[count]] = await db().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM admin_users WHERE role='owner'");
    if (Number(count.n) <= 1) throw new Error("The last owner cannot be removed.");
  }
  await db().execute("DELETE FROM admin_users WHERE id=?", [id]);
}
