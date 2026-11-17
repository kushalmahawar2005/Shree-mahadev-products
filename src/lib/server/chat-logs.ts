import "server-only";

import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";

export type ChatEngine = "ai" | "cache" | "local" | "orders" | "medical";
export type ChatLogStatus = "new" | "resolved" | "ignored";
export type ChatLog = { id: number; sessionId: string | null; feedback: number | null; question: string; answer: string | null; engine: ChatEngine; answered: boolean; status: ChatLogStatus; createdAt: string };
export type ChatAnswer = { id: number; question: string; answer: string; keywords: string; active: boolean; updatedAt: string };

/** Masks phone-like digit runs, emails and order numbers' neighbours so logs hold no contact details. */
export function redact(text: string) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?\d[\s-]?){8,}/g, "[number]");
}

/** Fire-and-forget: logging must never break or slow a chat reply. */
export function logChat(entry: { sessionId?: string; msgKey?: string; question: string; answer: string; engine: ChatEngine; answered: boolean }) {
  if (!process.env.DATABASE_NAME) return;
  db().execute(
    "INSERT INTO chat_logs (session_id, msg_key, question, answer, engine, answered) VALUES (?,?,?,?,?,?)",
    [entry.sessionId ?? null, entry.msgKey ?? null, redact(entry.question).slice(0, 500), redact(entry.answer).slice(0, 4000), entry.engine, entry.answered ? 1 : 0],
  ).catch((error) => console.error("chat log", error));
}

/** Thumbs up/down from the widget. A thumbs-down puts the question back in the "needs answer" queue. */
export async function setChatFeedback(msgKey: string, value: 1 | -1) {
  await db().execute(
    value === -1
      ? "UPDATE chat_logs SET feedback = -1, answered = 0, status = 'new' WHERE msg_key = ? ORDER BY id DESC LIMIT 1"
      : "UPDATE chat_logs SET feedback = 1 WHERE msg_key = ? ORDER BY id DESC LIMIT 1",
    [msgKey],
  );
}

const toLog = (row: RowDataPacket): ChatLog => ({
  id: Number(row.id), sessionId: row.session_id ? String(row.session_id) : null, feedback: row.feedback == null ? null : Number(row.feedback), question: String(row.question),
  answer: row.answer == null ? null : String(row.answer), engine: row.engine as ChatEngine, answered: Boolean(row.answered),
  status: row.status as ChatLogStatus, createdAt: String(row.created_at),
});

export async function listChatLogs(filter: "open" | "all", limit = 200) {
  const where = filter === "open" ? "WHERE answered = 0 AND status = 'new'" : "";
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT id, session_id, feedback, question, answer, engine, answered, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM chat_logs ${where} ORDER BY id DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toLog);
}

export async function chatStats(days = 14) {
  const [[totals]] = await db().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(answered = 1) AS answered,
            SUM(engine IN ('ai','cache')) AS ai,
            SUM(engine = 'orders') AS orders,
            COUNT(DISTINCT session_id) AS sessions
     FROM chat_logs WHERE created_at >= CURDATE() - INTERVAL ? DAY`,
    [days - 1],
  );
  const [[open]] = await db().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM chat_logs WHERE answered = 0 AND status = 'new'");
  const [daily] = await db().query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS total, SUM(answered = 0) AS unanswered
     FROM chat_logs WHERE created_at >= CURDATE() - INTERVAL ? DAY GROUP BY day`,
    [days - 1],
  );
  const byDay = new Map(daily.map((row) => [String(row.day), row]));
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.now() + 5.5 * 3_600_000);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const day = date.toISOString().slice(0, 10);
    const row = byDay.get(day);
    return { day, answered: Number(row?.total ?? 0) - Number(row?.unanswered ?? 0), unanswered: Number(row?.unanswered ?? 0) };
  });
  return {
    total: Number(totals.total ?? 0),
    answered: Number(totals.answered ?? 0),
    ai: Number(totals.ai ?? 0),
    orders: Number(totals.orders ?? 0),
    sessions: Number(totals.sessions ?? 0),
    open: Number(open.n ?? 0),
    series,
  };
}

export async function setChatLogStatus(ids: number[], status: ChatLogStatus) {
  if (!ids.length) return;
  await db().query("UPDATE chat_logs SET status = ? WHERE id IN (?)", [status, ids]);
}

export async function listChatAnswers(onlyActive = false) {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT id, question, answer, keywords, active, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM chat_answers ${onlyActive ? "WHERE active = 1" : ""} ORDER BY id DESC`,
  );
  return rows.map((row): ChatAnswer => ({
    id: Number(row.id), question: String(row.question), answer: String(row.answer), keywords: String(row.keywords),
    active: Boolean(row.active), updatedAt: String(row.updated_at),
  }));
}

export async function saveChatAnswer(input: { id?: number; question: string; answer: string; keywords: string; active: boolean }) {
  if (input.id) {
    await db().execute("UPDATE chat_answers SET question=?, answer=?, keywords=?, active=? WHERE id=?", [input.question, input.answer, input.keywords, input.active ? 1 : 0, input.id]);
    return input.id;
  }
  const [result] = await db().execute<import("mysql2/promise").ResultSetHeader>(
    "INSERT INTO chat_answers (question, answer, keywords, active) VALUES (?,?,?,?)",
    [input.question, input.answer, input.keywords, input.active ? 1 : 0],
  );
  return result.insertId;
}

export async function deleteChatAnswer(id: number) {
  await db().execute("DELETE FROM chat_answers WHERE id = ?", [id]);
}
