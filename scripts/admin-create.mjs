// Create an admin, or reset an existing admin's password (logs them out everywhere).
// Usage: pnpm admin:create <username> <password> [role]
import { randomBytes, scryptSync } from "node:crypto";
import mysql from "mysql2/promise";

try { process.loadEnvFile(".env.local"); } catch {}
const [username, password, role = "owner"] = process.argv.slice(2);
if (!username || !password || password.length < 10) {
  console.error("Usage: pnpm admin:create <username> <password(min 10 chars)> [owner|manager|staff]");
  process.exit(1);
}
const N = 2 ** 15, R = 8, P = 1;
const salt = randomBytes(16);
const key = scryptSync(password, salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
const hash = `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
const db = await mysql.createConnection({ host: process.env.DATABASE_HOST, port: +(process.env.DATABASE_PORT ?? 3306), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
const [r] = await db.execute(
  `INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,?)
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), session_version = session_version + 1`,
  [username, hash, role],
);
console.log(r.affectedRows === 1 ? `Created admin "${username}" (${role}).` : `Updated "${username}": new password, logged out everywhere.`);
await db.end();
