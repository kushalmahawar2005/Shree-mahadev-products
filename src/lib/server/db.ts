import "server-only";
import mysql, { type Pool } from "mysql2/promise";

const g = globalThis as unknown as { __smpPool?: Pool };

/** One MySQL pool per process (survives dev HMR). */
export function db(): Pool {
  if (!g.__smpPool) {
    if (!process.env.DATABASE_NAME) throw new Error("DATABASE_NAME is not set");
    g.__smpPool = mysql.createPool({
      host: process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectionLimit: 5,
      timezone: "+05:30",
      dateStrings: true,
    });
    // Store and read all timestamps in IST, whatever the server's own time zone is.
    g.__smpPool.pool.on("connection", (conn) => {
      conn.query("SET time_zone = '+05:30'");
    });
  }
  return g.__smpPool;
}
