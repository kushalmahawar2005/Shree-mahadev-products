"use server";

import { z } from "zod";
import { logAdminActivity, requireRole } from "@/lib/server/admin-auth";
import { clearAnswerCache } from "@/lib/server/chat-ai";
import { deleteChatAnswer, saveChatAnswer, setChatLogStatus } from "@/lib/server/chat-logs";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: unknown): { ok: false; error: string } => ({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." });

const AnswerInput = z.object({
  id: z.number().int().positive().optional(),
  question: z.string().trim().min(3, "Write the customer question.").max(300),
  answer: z.string().trim().min(3, "Write the answer.").max(3000),
  keywords: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
  resolveLogIds: z.array(z.number().int().positive()).max(200).default([]),
}).strict();

export async function saveChatAnswerAction(raw: unknown): Promise<Result<{ id: number }>> {
  try {
    const admin = await requireRole("owner", "manager");
    const input = AnswerInput.parse(raw);
    const id = await saveChatAnswer(input);
    if (input.resolveLogIds.length) await setChatLogStatus(input.resolveLogIds, "resolved");
    clearAnswerCache();
    await logAdminActivity(admin.username, input.id ? "chat_answer.update" : "chat_answer.create", `chat_answer:${id}`, { question: input.question });
    return { ok: true, id };
  } catch (error) {
    return fail(error instanceof z.ZodError ? new Error(error.issues[0]?.message) : error);
  }
}

export async function deleteChatAnswerAction(raw: unknown): Promise<Result> {
  try {
    const admin = await requireRole("owner", "manager");
    const { id } = z.object({ id: z.number().int().positive() }).strict().parse(raw);
    await deleteChatAnswer(id);
    clearAnswerCache();
    await logAdminActivity(admin.username, "chat_answer.delete", `chat_answer:${id}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setChatLogStatusAction(raw: unknown): Promise<Result> {
  try {
    await requireRole("owner", "manager");
    const input = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200), status: z.enum(["new", "resolved", "ignored"]) }).strict().parse(raw);
    await setChatLogStatus(input.ids, input.status);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
