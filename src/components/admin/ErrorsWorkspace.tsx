"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Bug, CheckCircle2, ChevronDown, Loader2, Monitor, Server } from "lucide-react";
import { StatTile } from "@/components/admin/ui";
import { unwrap } from "@/lib/action-result";
import { resolveErrorsAction } from "@/lib/error-admin-actions";
import type { ErrorRow } from "@/lib/server/error-log";
import { cn } from "@/lib/utils/cn";

export function ErrorsWorkspace({ rows, show }: { rows: ErrorRow[]; show: "open" | "all" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const open = rows.filter((r) => !r.resolved);
  // "Today" = the newest error's IST date (avoids reading the clock during render).
  const latestDay = rows.reduce((d, r) => (r.lastAt > d ? r.lastAt : d), "").slice(0, 10);
  const todayCount = latestDay ? open.filter((r) => r.lastAt.startsWith(latestDay)).length : 0;
  const resolve = (ids: number[] | "all", msg: string) =>
    start(async () => {
      try {
        unwrap(await resolveErrorsAction(ids));
        setNotice(msg);
        router.refresh();
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Could not update.");
      }
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Bug} label="Open errors" value={String(open.length)} note="not marked fixed" tone={open.length ? "warn" : undefined} />
        <StatTile icon={AlertTriangle} label="Latest day" value={String(todayCount)} note={latestDay ? `open errors seen on ${latestDay}` : "nothing yet"} />
        <StatTile icon={Server} label="Server" value={String(open.filter((r) => r.source === "server").length)} note="pages, APIs, actions" />
        <StatTile icon={Monitor} label="Browser" value={String(open.filter((r) => r.source === "client").length)} note="crashes on shoppers' devices" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-line bg-surface p-1">
          {(["open", "all"] as const).map((s) => (
            <Link
              key={s}
              href={s === "open" ? "/admin/errors" : "/admin/errors?show=all"}
              className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold", show === s ? "bg-forest text-white" : "text-ink-muted hover:text-forest-fg")}
            >
              {s === "open" ? "Open" : "All (incl. fixed)"}
            </Link>
          ))}
        </div>
        {open.length > 0 && (
          <button type="button" disabled={pending} onClick={() => resolve("all", "All errors marked fixed")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:border-forest/50">
            <CheckCircle2 className="size-4" /> Mark all fixed
          </button>
        )}
        {(pending || notice) && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {notice}
          </span>
        )}
      </div>

      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          {rows.map((r) => (
            <li key={r.id} className={cn(r.resolved && "opacity-60")}>
              <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-subtle">
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", r.source === "server" ? "bg-khaki-soft text-forest-fg" : "bg-warm text-ink")}>
                  {r.source === "server" ? <Server className="size-4" /> : <Monitor className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-ink">{r.message}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {r.routeType ?? r.source} · {r.route ?? r.path ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-ink-muted">
                  <span className="block font-semibold text-ink tabular-nums">×{r.count}</span>
                  {r.lastAt.slice(5, 16)}
                </span>
                <ChevronDown className={cn("mt-1 size-4 shrink-0 text-ink-muted transition-transform", openId === r.id && "rotate-180")} />
              </button>
              {openId === r.id && (
                <div className="space-y-3 border-t border-line bg-subtle px-4 py-3 text-xs">
                  <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div><dt className="inline text-ink-muted">First seen: </dt><dd className="inline">{r.firstAt}</dd></div>
                    <div><dt className="inline text-ink-muted">Last seen: </dt><dd className="inline">{r.lastAt}</dd></div>
                    <div><dt className="inline text-ink-muted">Last URL: </dt><dd className="inline break-all">{r.path ?? "—"}</dd></div>
                    <div><dt className="inline text-ink-muted">Method / ref: </dt><dd className="inline">{r.method ?? "—"} {r.digest ? `· ${r.digest}` : ""}</dd></div>
                  </dl>
                  {r.stack && <pre className="max-h-64 overflow-auto rounded-lg bg-surface p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink">{r.stack}</pre>}
                  {!r.resolved && (
                    <button type="button" disabled={pending} onClick={() => resolve([r.id], "Marked fixed")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-xs font-semibold text-white hover:bg-forest-deep">
                      <CheckCircle2 className="size-4" /> Mark fixed
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-line bg-surface px-5 py-12 text-center">
          <CheckCircle2 className="mx-auto size-8 text-forest-fg" />
          <p className="mt-2 font-semibold text-forest-text">No open errors</p>
          <p className="mt-1 text-sm text-ink-muted">The website hasn&apos;t hit any new problems.</p>
        </div>
      )}
    </div>
  );
}
