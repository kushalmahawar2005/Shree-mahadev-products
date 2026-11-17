"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { BookPlus, Bot, CheckCircle2, CircleHelp, EyeOff, MessagesSquare, MoreHorizontal, Pencil, Plus, Search, Sparkles, ThumbsDown, Trash2 } from "lucide-react";
import { StatTile } from "@/components/admin/ui";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/shadcn/alert-dialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Switch } from "@/components/shadcn/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { Textarea } from "@/components/shadcn/textarea";
import { deleteChatAnswerAction, saveChatAnswerAction, setChatLogStatusAction } from "@/lib/chat-admin-actions";
import type { ChatAnswer, ChatLog } from "@/lib/server/chat-logs";

type Stats = { total: number; answered: number; ai: number; orders: number; sessions: number; open: number; series: { day: string; answered: number; unanswered: number }[] };
type Draft = { id?: number; question: string; answer: string; keywords: string; active: boolean; resolveLogIds: number[] };

const chartConfig = {
  answered: { label: "Answered", color: "var(--color-forest)" },
  unanswered: { label: "Not answered", color: "var(--color-mustard)" },
} satisfies ChartConfig;

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const istDate = (value: string) => new Date(`${value.replace(" ", "T")}+05:30`);
const engineLabel: Record<ChatLog["engine"], string> = { ai: "AI", cache: "AI (cached)", local: "Store search", orders: "Order flow", medical: "Health guard" };

export function ChatAssistantWorkspace({ stats, openLogs, recentLogs, answers, aiOn }: { stats: Stats; openLogs: ChatLog[]; recentLogs: ChatLog[]; answers: ChatAnswer[]; aiOn: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<ChatAnswer | null>(null);

  const rate = stats.total ? Math.round((stats.answered / stats.total) * 100) : 0;
  const insight = !stats.total
    ? "No chats yet in the last 14 days. Questions will appear here as shoppers use the assistant."
    : `${stats.total} questions in 14 days. The assistant answered ${rate}%${stats.open ? `, and ${stats.open} still need${stats.open === 1 ? "s" : ""} your answer` : ""}.`;

  const filteredRecent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recentLogs.filter((log) => `${log.question} ${log.answer ?? ""}`.toLowerCase().includes(q)) : recentLogs;
  }, [query, recentLogs]);

  function run(task: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await task();
      if (!result.ok) { setError(result.error ?? "Something went wrong."); return; }
      after?.();
      router.refresh();
    });
  }

  const saveDraft = () => draft && run(() => saveChatAnswerAction(draft), () => setDraft(null));
  const teach = (log: ChatLog) => setDraft({ question: log.question, answer: "", keywords: "", active: true, resolveLogIds: [log.id] });

  return (
    <div className="space-y-6">
      {!aiOn && (
        <div className="rounded-2xl border border-warm-line bg-warm px-4 py-3 text-sm text-ink">
          <strong>AI is off.</strong> Set <code>GEMINI_API_KEY</code> on the server. Until then the assistant uses basic store search only.
        </div>
      )}

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-forest-fg"><Sparkles className="size-4" />Last 14 days</p>
            <p className="mt-1 max-w-2xl text-lg font-semibold tracking-tight text-ink">{insight}</p>
          </div>
          <Button onClick={() => setDraft({ question: "", answer: "", keywords: "", active: true, resolveLogIds: [] })} className="h-10 rounded-full bg-forest px-5 text-white hover:bg-forest-mid"><Plus className="size-4" />Add answer</Button>
        </div>
        <ChartContainer config={chartConfig} className="mt-4 aspect-auto h-48 w-full">
          <BarChart data={stats.series} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(value: string) => dayFmt.format(istDate(`${value} 12:00:00`))} />
            <ChartTooltip cursor={{ fill: "var(--color-khaki-soft)" }} content={<ChartTooltipContent labelFormatter={(value) => dayFmt.format(istDate(`${value} 12:00:00`))} />} />
            <Bar dataKey="answered" stackId="a" fill="var(--color-answered)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="unanswered" stackId="a" fill="var(--color-unanswered)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={MessagesSquare} label="Questions" value={stats.total.toLocaleString("en-IN")} note={`${stats.sessions} chats`} />
        <StatTile icon={Bot} label="Answered" value={`${rate}%`} note={`${stats.ai} by AI`} />
        <StatTile icon={CircleHelp} label="Needs your answer" value={String(stats.open)} note="Not answered or 👎" tone={stats.open ? "warn" : undefined} />
        <StatTile icon={BookPlus} label="Your answers" value={String(answers.length)} note={`${answers.filter((a) => a.active).length} live`} />
      </div>

      {error && <p className="rounded-xl bg-alert-soft px-4 py-2.5 text-sm text-alert">{error}</p>}

      <Tabs defaultValue={openLogs.length ? "open" : "all"}>
        <TabsList className="rounded-full">
          <TabsTrigger value="open" className="rounded-full">Needs answer{openLogs.length ? <Badge className="ml-1.5 h-5 bg-mustard px-1.5 text-forest">{openLogs.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="all" className="rounded-full">All questions</TabsTrigger>
          <TabsTrigger value="answers" className="rounded-full">Your answers</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          {!openLogs.length ? (
            <Empty icon={CheckCircle2} title="All caught up" text="Every recent question was answered. New gaps and 👎 replies show up here." />
          ) : (
            <ul className={`${card} divide-y divide-line`}>
              {openLogs.map((log) => (
                <li key={log.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{log.question}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      {timeFmt.format(istDate(log.createdAt))} · {engineLabel[log.engine]}
                      {log.feedback === -1 && <span className="inline-flex items-center gap-1 text-alert"><ThumbsDown className="size-3" />Shopper marked unhelpful</span>}
                    </p>
                    {log.answer && log.answer !== "no match" && <p className="mt-2 line-clamp-2 rounded-lg bg-subtle px-3 py-2 text-sm text-ink-muted">Bot said: {log.answer.replaceAll("**", "")}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => teach(log)} className="rounded-full bg-forest text-white hover:bg-forest-mid"><BookPlus className="size-4" />Teach answer</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setChatLogStatusAction({ ids: [log.id], status: "ignored" }))} className="rounded-full"><EyeOff className="size-4" />Ignore</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" className="h-10 rounded-full bg-surface pl-9" />
          </div>
          {!filteredRecent.length ? (
            <Empty icon={MessagesSquare} title="No questions" text={query ? "Nothing matches that search." : "Questions appear here once shoppers start chatting."} />
          ) : (
            <ul className={`${card} divide-y divide-line`}>
              {filteredRecent.map((log) => (
                <li key={log.id} className="group flex gap-3 p-4 hover:bg-subtle">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{log.question}</p>
                      {!log.answered && <Badge variant="outline" className="border-warm-line bg-warm text-[11px] text-ink">Not answered</Badge>}
                      {log.feedback === 1 && <Badge variant="outline" className="text-[11px]">👍</Badge>}
                      {log.feedback === -1 && <Badge variant="outline" className="text-[11px]">👎</Badge>}
                    </div>
                    {log.answer && !["no match", "opened order flow", "medical disclaimer"].includes(log.answer) && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{log.answer.replaceAll("**", "")}</p>}
                    <p className="mt-1 text-xs text-ink-muted">{timeFmt.format(istDate(log.createdAt))} · {engineLabel[log.engine]}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Question actions" className="size-8 shrink-0"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => teach(log)}><BookPlus className="size-4" />Write a better answer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="answers" className="mt-4">
          {!answers.length ? (
            <Empty icon={BookPlus} title="No custom answers yet" text="Answers you add here are used by the assistant before anything else." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {answers.map((item) => (
                <li key={item.id} className={`${card} flex flex-col p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{item.question}</p>
                    <Badge variant="outline" className={item.active ? "border-forest/30 text-forest-fg" : "text-ink-muted"}>{item.active ? "Live" : "Off"}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-ink-muted">{item.answer}</p>
                  {item.keywords && <p className="mt-2 truncate text-xs text-ink-muted">Keywords: {item.keywords}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDraft({ id: item.id, question: item.question, answer: item.answer, keywords: item.keywords, active: item.active, resolveLogIds: [] })}><Pencil className="size-3.5" />Edit</Button>
                    <Button size="sm" variant="ghost" className="rounded-full text-alert hover:bg-alert-soft hover:text-alert" onClick={() => setDeleting(item)}><Trash2 className="size-3.5" />Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit answer" : "Teach the assistant"}</DialogTitle>
            <DialogDescription>The assistant uses this as store information and rephrases it in the shopper&apos;s language.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="chat-q">Customer question</Label>
                <Input id="chat-q" value={draft.question} maxLength={300} onChange={(event) => setDraft({ ...draft, question: event.target.value })} placeholder="e.g. Do you ship to Nepal?" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-a">Answer</Label>
                <Textarea id="chat-a" value={draft.answer} maxLength={3000} rows={5} autoFocus onChange={(event) => setDraft({ ...draft, answer: event.target.value })} placeholder="Write the correct answer in plain words. English or Hindi is fine." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chat-k">Other ways people ask <span className="font-normal text-ink-muted">(optional, comma separated)</span></Label>
                <Input id="chat-k" value={draft.keywords} maxLength={500} onChange={(event) => setDraft({ ...draft, keywords: event.target.value })} placeholder="nepal, international, bahar bhejte ho" />
              </div>
              <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm">
                <span>Live for shoppers</span>
                <Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} />
              </label>
              {error && <p className="text-sm text-alert">{error}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={saveDraft} disabled={pending || !draft?.question.trim() || !draft?.answer.trim()} className="bg-forest text-white hover:bg-forest-mid">{pending ? "Saving…" : "Save answer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this answer?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleting?.question}&rdquo; will no longer be used by the assistant. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-alert text-white hover:bg-alert/90" onClick={() => deleting && run(() => deleteChatAnswerAction({ id: deleting.id }), () => setDeleting(null))}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Bot; title: string; text: string }) {
  return (
    <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
      <Icon className="size-8 text-forest-fg" />
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{text}</p>
    </div>
  );
}
