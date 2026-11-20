import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

/**
 * Admin side of the self-hosted error monitoring: list / resolve rows in `error_log`.
 * Capturing lives in src/lib/error-capture.ts (used by instrumentation.ts and the browser action).
 */

export type ErrorRow = {
  id: number;
  source: string;
  routeType: string | null;
  route: string | null;
  path: string | null;
  method: string | null;
  message: string;
  stack: string | null;
  digest: string | null;
  count: number;
  resolved: boolean;
  firstAt: string;
  lastAt: string;
};

export async function listErrors(show: "open" | "all" = "open", limit = 200): Promise<ErrorRow[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT * FROM error_log ${show === "open" ? "WHERE resolved = 0" : ""} ORDER BY resolved, last_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    source: String(r.source),
    routeType: r.route_type ?? null,
    route: r.route ?? null,
    path: r.path ?? null,
    method: r.method ?? null,
    message: String(r.message),
    stack: r.stack ?? null,
    digest: r.digest ?? null,
    count: Number(r.count),
    resolved: Boolean(r.resolved),
    firstAt: String(r.first_at),
    lastAt: String(r.last_at),
  }));
}

export async function openErrorCount(): Promise<number> {
  const [[r]] = await db().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM error_log WHERE resolved = 0");
  return Number(r?.n ?? 0);
}

export async function resolveErrors(ids: number[] | "all") {
  if (ids === "all") await db().execute("UPDATE error_log SET resolved = 1 WHERE resolved = 0");
  else if (ids.length) await db().query("UPDATE error_log SET resolved = 1 WHERE id IN (?)", [ids]);
}
