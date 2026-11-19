"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Inbox, MessageCircle, Phone } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";
import { ISSUES, TICKET_STATUS, isSupportVideo, shortDate, type HelpTicket, type IssueKey } from "./help-lib";

const issueLabel = (k: string) => ISSUES[k as IssueKey] ?? k;

function StatusPill({ status }: { status: string }) {
  const s = TICKET_STATUS[status] ?? TICKET_STATUS.open!;
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", s.cls)}>{s.label}</span>;
}

/** "My requests": past help tickets, collapsible; a row opens a side sheet with the details. */
export function MyRequests({ tickets, openTicket }: { tickets: HelpTicket[]; openTicket?: string }) {
  const initial = tickets.find((t) => t.ticketNo === openTicket) ?? null;
  const [expanded, setExpanded] = useState(Boolean(initial));
  const [active, setActive] = useState<HelpTicket | null>(initial);
  if (!tickets.length) return null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-5 border-t border-line pt-4">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 text-left text-base font-semibold text-ink">
        <Inbox className="size-5 text-co-accent-ink" />
        My requests
        <span className="rounded-full bg-page px-2 text-xs font-semibold text-ink-muted tabular-nums">{tickets.length}</span>
        <ChevronDown className={cn("ml-auto size-4 text-ink-muted transition-transform", expanded && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 divide-y divide-line">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setActive(t)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-page"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
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

      <Sheet open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="co-theme w-full bg-white sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-ink">
                  {active.ticketNo} <StatusPill status={active.status} />
                </SheetTitle>
                <SheetDescription>{formatDateTime(active.createdAt)}</SheetDescription>
              </SheetHeader>
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
                {active.message && (
                  <div>
                    <dt className="text-ink-muted">Message</dt>
                    <dd className="whitespace-pre-wrap text-ink">{active.message}</dd>
                  </div>
                )}
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </Collapsible>
  );
}
