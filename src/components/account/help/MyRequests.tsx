"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Inbox, Loader2, MessageCircle, Phone, Send } from "lucide-react";
import { markTicketSeenAction, replyToTicketAction } from "@/lib/account/support-actions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { CLAIM_ISSUES, ISSUES, TICKET_STATUS, isSupportVideo, shortDate, type HelpTicket, type IssueKey } from "./help-lib";
import { SendVideoStep } from "./SendVideoStep";

const issueLabel = (k: string) => ISSUES[k as IssueKey] ?? k;

function StatusPill({ status }: { status: string }) {
  const s = TICKET_STATUS[status] ?? TICKET_STATUS.open!;
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", s.cls)}>{s.label}</span>;
}

/** "My requests": past help tickets, collapsible; a row opens a side sheet with the details. */
export function MyRequests({ tickets: initialTickets, openTicket }: { tickets: HelpTicket[]; openTicket?: string }) {
  const [tickets, setTickets] = useState(initialTickets);
  const initialId = initialTickets.find((t) => t.ticketNo === openTicket)?.id ?? null;
  const [expanded, setExpanded] = useState(Boolean(initialId) || initialTickets.some((t) => t.unread));
  const [activeId, setActiveId] = useState<number | null>(initialId);
  const active = tickets.find((t) => t.id === activeId) ?? null;
  const unread = tickets.filter((t) => t.unread).length;
  if (!tickets.length) return null;

  const open = (t: HelpTicket) => {
    setActiveId(t.id);
    if (t.unread) {
      setTickets((list) => list.map((x) => (x.id === t.id ? { ...x, unread: false } : x)));
      void markTicketSeenAction({ ticketId: t.id });
    }
  };
  const appendReply = (ticketId: number, body: string) =>
    setTickets((list) =>
      list.map((x) =>
        x.id === ticketId
          ? {
              ...x,
              status: x.status === "resolved" ? "open" : x.status,
              // Same IST "YYYY-MM-DD HH:MM:SS" shape the DB returns, so formatDateTime reads it the same way.
              messages: [...x.messages, { id: -Date.now(), author: "customer", name: "You", body, at: new Date(Date.now() + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 19) }],
            }
          : x,
      ),
    );

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-5 border-t border-line pt-4">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 text-left text-base font-semibold text-ink">
        <Inbox className="size-5 text-co-accent-ink" />
        My requests
        <span className="rounded-full bg-page px-2 text-xs font-semibold text-ink-muted tabular-nums">{tickets.length}</span>
        {unread > 0 && (
          <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] font-semibold text-white">
            {unread} new {unread === 1 ? "reply" : "replies"}
          </span>
        )}
        <ChevronDown className={cn("ml-auto size-4 text-ink-muted transition-transform", expanded && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 divide-y divide-line">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => open(t)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-page"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {t.unread && <span className="size-2 shrink-0 rounded-full bg-forest" aria-label="New reply" />}
                    {t.ticketNo} · {issueLabel(t.issue)}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {shortDate(t.createdAt)}
                    {t.orderNo ? ` · Order #${t.orderNo}` : " · General"}
                  </span>
                </span>
                <StatusPill status={t.status} />
                <ChevronRight className="size-4 shrink-0 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>

      <Sheet open={Boolean(active)} onOpenChange={(o) => !o && setActiveId(null)}>
        <SheetContent className="co-theme flex w-full flex-col gap-0 bg-white sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-ink">
                  {active.ticketNo} <StatusPill status={active.status} />
                </SheetTitle>
                <SheetDescription>{formatDateTime(active.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <dl className="space-y-4 px-4 text-sm">
                <div>
                  <dt className="text-ink-muted">Order</dt>
                  <dd className="font-semibold text-ink">
                    {active.orderId && active.orderNo ? (
                      <Link href={`/account/orders/${active.orderId}`} className="text-forest-text underline underline-offset-2">
                        #{active.orderNo}
                      </Link>
                    ) : (
                      "Not about a specific order"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Issue</dt>
                  <dd className="font-semibold text-ink">{issueLabel(active.issue)}</dd>
                </div>

                {active.utr && (
                  <div>
                    <dt className="text-ink-muted">UPI / UTR reference</dt>
                    <dd className="font-mono text-ink">{active.utr}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-ink-muted">Contact</dt>
                  <dd className="flex items-center gap-1.5 text-ink">
                    {active.contactPref === "call" ? (
                      <>
                        <Phone className="size-4" /> Call back {active.callbackSlot}
                      </>
                    ) : (
                      <>
                        <MessageCircle className="size-4" /> Support ticket
                      </>
                    )}
                  </dd>
                </div>
                {active.photos.length > 0 && (
                  <div>
                    <dt className="text-ink-muted">Attachments</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {active.photos.map((u) =>
                        isSupportVideo(u) ? (
                          <video key={u} src={u} controls playsInline preload="metadata" className="max-h-48 w-full rounded-xl border border-line bg-black" />
                        ) : (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block size-20 overflow-hidden rounded-xl border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element -- customer upload, any format (HEIC) */}
                            <img src={u} alt="Attached photo" className="size-full object-cover" />
                          </a>
                        ),
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              {CLAIM_ISSUES.includes(active.issue as IssueKey) && active.status !== "resolved" && (
                <SendVideoStep orderNo={active.orderNo} refNo={active.ticketNo} className="mx-4 mt-4" />
              )}
              <Thread ticket={active} />
              </div>
              <ReplyBox ticketId={active.id} onSent={(body) => appendReply(active.id, body)} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </Collapsible>
  );
}

/** The conversation: the customer's first message, then team replies and follow-ups. */
function Thread({ ticket }: { ticket: HelpTicket }) {
  const items = [
    ...(ticket.message ? [{ id: 0, author: "customer" as const, name: "You", body: ticket.message, at: ticket.createdAt }] : []),
    ...ticket.messages,
  ];
  return (
    <section className="mt-5 border-t border-line px-4 pt-4" aria-label="Conversation">
      <h3 className="text-sm font-semibold text-ink">Conversation</h3>
      {items.length ? (
        <ol className="mt-3 space-y-3">
          {items.map((m) => (
            <li key={m.id} className={cn("flex", m.author === "team" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  m.author === "team" ? "rounded-bl-md bg-co-brand-soft text-ink" : "rounded-br-md bg-forest text-white",
                )}
              >
                <p className="text-[11px] font-semibold opacity-75">{m.author === "team" ? "Swadeshi Mahadev team" : "You"}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10.5px] opacity-60">{formatDateTime(m.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No messages yet.</p>
      )}
      {!ticket.messages.some((m) => m.author === "team") && (
        <p className="mt-3 rounded-xl bg-page px-3 py-2 text-xs text-ink-muted">Our team will reply here during working hours. You&apos;ll also get an email if your account has one.</p>
      )}
    </section>
  );
}

function ReplyBox({ ticketId, onSent }: { ticketId: number; onSent: (body: string) => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const text = body.trim();
      if (!text) return;
      setError("");
      const r = await replyToTicketAction({ ticketId, body: text });
      if (!r.ok) return setError(r.error);
      setBody("");
      onSent(text);
    });
  return (
    <div className="border-t border-line bg-white p-3">
      {error && (
        <p role="alert" className="mb-2 text-xs text-co-danger">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-page p-1.5 focus-within:border-forest">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder="Write a message to our team"
          aria-label="Your message"
          className="min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-ink outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          aria-label="Send message"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest text-white disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
