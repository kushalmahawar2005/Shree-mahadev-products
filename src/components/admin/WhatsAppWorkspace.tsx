"use client";

import { unwrap } from "@/lib/action-result";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, BellOff, CheckCheck, Clock, Loader2, MessageCircle, Plug, RefreshCw, Search, Send, ShoppingCart, Truck, XCircle } from "lucide-react";
import { optOutWhatsAppAction, processWhatsAppAction, toggleWhatsAppTemplateAction } from "@/lib/whatsapp-actions";
import { Switch } from "@/components/shadcn/switch";
import { StatTile } from "@/components/admin/ui";
import { cn } from "@/lib/utils/cn";

type Template = { template: string; enabled: number };
type Message = { id: number; template: string; to_phone: string; status: string; attempts?: number; error?: string | null; created_at: string };
type Filter = "all" | "pending" | "sent" | "failed";

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const INFO: Record<string, { label: string; hint: string; group: "orders" | "recovery" }> = {
  order_placed: { label: "Order placed", hint: "Thank-you with order link", group: "orders" },
  cod_confirmation: { label: "COD confirmation", hint: "Asks to confirm a COD order", group: "orders" },
  payment_pending: { label: "Payment not completed", hint: "30 min after an online payment fails, with a pay-now link (+ email)", group: "recovery" },
  shipped: { label: "Shipped", hint: "Tracking link once booked", group: "orders" },
  out_for_delivery: { label: "Out for delivery", hint: "Morning of delivery, COD amount to keep ready (+ email)", group: "orders" },
  delivery_failed: { label: "Delivery attempt failed", hint: "Courier missed them: reply with time / address (+ email)", group: "orders" },
  delivered: { label: "Delivered", hint: "Delivery note + review link", group: "orders" },
  cancelled: { label: "Cancelled", hint: "Lets them know it's cancelled", group: "orders" },
  abandoned_cart_1h: { label: "Abandoned cart · 1 hr", hint: "First nudge with recovery link", group: "recovery" },
  abandoned_cart_24h: { label: "Abandoned cart · 24 hr", hint: "Second, final reminder", group: "recovery" },
  back_in_stock: { label: "Back in stock", hint: "When a waited-for size returns", group: "recovery" },
};
/** Display order: the customer's journey, not the database order. */
const ORDER = Object.keys(INFO);
const label = (t: string) => INFO[t]?.label ?? t.replaceAll("_", " ");
const when = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(String(d).replace(" ", "T") + "+05:30"));
const phone = (p: string) => (p.length === 12 && p.startsWith("91") ? `+91 ${p.slice(2, 7)} ${p.slice(7)}` : p);
const TONE: Record<string, string> = {
  sent: "bg-forest/10 text-forest-fg",
  failed: "bg-alert-soft text-alert",
  pending: "bg-warm-strong text-sale",
  sending: "bg-warm-strong text-sale",
};

export function WhatsAppWorkspace({
  templates,
  messages,
  connected,
  previews = {},
}: {
  templates: Template[];
  messages: Message[];
  connected: boolean;
  /** Exact text each automation sends, with sample values. */
  previews?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyTpl, setBusyTpl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const run = (fn: () => Promise<string | void>, ok: string) =>
    start(async () => {
      try {
        const msg = await fn();
        setNotice({ ok: true, text: msg || ok });
        router.refresh();
      } catch (e) {
        setNotice({ ok: false, text: e instanceof Error ? e.message.replace(/^\[.*?\]\s*/, "") : "Could not save." });
      } finally {
        setBusyTpl(null);
      }
    });

  const count = (s: string) => messages.filter((m) => (s === "pending" ? m.status === "pending" || m.status === "sending" : m.status === s)).length;
  const digits = q.replace(/\D/g, "");
  const shown = messages.filter(
    (m) =>
      (filter === "all" || (filter === "pending" ? m.status === "pending" || m.status === "sending" : m.status === filter)) &&
      (!q || label(m.template).toLowerCase().includes(q.toLowerCase()) || (digits && m.to_phone.includes(digits))),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Messages</h1>
          <p className="mt-1 text-sm text-ink-muted">Automatic WhatsApp updates for orders and cart recovery.</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = unwrap(await processWhatsAppAction());
              if (r.waiting) return `${r.waiting} waiting: WhatsApp provider not connected yet`;
              return r.sent || r.failed ? `Sent ${r.sent}, failed ${r.failed}` : "Nothing due right now";
            }, "Done")
          }
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-forest-fg hover:bg-khaki-soft disabled:opacity-60"
        >
          {pending && !busyTpl ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Send queued now
        </button>
      </div>

      {!connected && (
        <div className="flex items-start gap-3 rounded-2xl border border-warm-line bg-warm p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warm-strong text-sale">
            <Plug className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-ink">WhatsApp provider not connected</p>
            <p className="text-sm text-ink-muted">
              Messages are queued but not sent. Add WHATSAPP_PROVIDER, WHATSAPP_API_URL and WHATSAPP_API_KEY on the server, then press &quot;Send queued now&quot;.
            </p>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" className={cn("text-sm", notice.ok ? "text-forest-fg" : "text-alert")}>
          {notice.text}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Summary">
        <StatTile icon={CheckCheck} label="Sent" value={String(count("sent"))} note="Last 100 messages" />
        <StatTile icon={Clock} label="In queue" value={String(count("pending"))} note="Waiting to send" tone={count("pending") ? "warn" : undefined} />
        <StatTile icon={XCircle} label="Failed" value={String(count("failed"))} note="After all retries" tone={count("failed") ? "warn" : undefined} />
        <StatTile icon={MessageCircle} label="Automations on" value={`${templates.filter((t) => t.enabled).length} / ${templates.length}`} note="Templates enabled" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {(
          [
            ["orders", "Order updates", Truck],
            ["recovery", "Cart recovery & stock", ShoppingCart],
          ] as const
        ).map(([group, title, Icon]) => (
          <section key={group} className={cn(card, "p-4 sm:p-5")}>
            <header className="mb-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
                <Icon className="size-4" />
              </span>
              <h2 className="font-bold text-forest-text">{title}</h2>
            </header>
            <ul className="divide-y divide-line">
              {templates
                .filter((t) => (INFO[t.template]?.group ?? "orders") === group)
                .sort((a, b) => ORDER.indexOf(a.template) - ORDER.indexOf(b.template))
                .map((t) => (
                  <li key={t.template} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{label(t.template)}</p>
                      <p className="text-xs text-ink-muted">{INFO[t.template]?.hint ?? t.template}</p>
                      {previews[t.template] && (
                        <details className="group/msg mt-1.5">
                          <summary className="cursor-pointer list-none text-xs font-semibold text-forest-fg hover:underline [&::-webkit-details-marker]:hidden">
                            <span className="group-open/msg:hidden">See message</span>
                            <span className="hidden group-open/msg:inline">Hide message</span>
                          </summary>
                          {/* WhatsApp-style bubble with the exact text (sample name / order / links). */}
                          <p className="mt-2 max-w-md rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
                            {previews[t.template]}
                          </p>
                        </details>
                      )}
                    </div>
                    {busyTpl === t.template && <Loader2 className="size-3.5 animate-spin text-ink-muted" />}
                    <Switch
                      checked={Boolean(t.enabled)}
                      disabled={pending}
                      aria-label={`${label(t.template)} message`}
                      onCheckedChange={(on) => {
                        setBusyTpl(t.template);
                        run(async () => unwrap(await toggleWhatsAppTemplateAction({ template: t.template, enabled: on })), `${label(t.template)} ${on ? "on" : "off"}`);
                      }}
                      className="data-[state=checked]:bg-forest"
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <section className={cn(card, "overflow-hidden")}>
        <header className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
              <Send className="size-4" />
            </span>
            <h2 className="font-bold text-forest-text">Delivery log</h2>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:ml-auto sm:px-0">
            <div className="flex w-max gap-1.5">
              {(["all", "pending", "sent", "failed"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold",
                    filter === f ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink-muted hover:text-forest-fg",
                  )}
                >
                  {f === "pending" ? "In queue" : f === "all" ? "All" : f === "sent" ? "Sent" : "Failed"}
                  <span className={filter === f ? "text-white/75" : "text-ink-muted/70"}>{f === "all" ? messages.length : count(f)}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="relative sm:w-56">
            <span className="sr-only">Search messages</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Phone or template"
              className="h-9 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-forest-fg"
            />
          </label>
        </header>
        {!shown.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">{messages.length ? "No messages match." : "No messages yet."}</p>
        ) : (
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto" data-lenis-prevent="">
            {shown.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-khaki-soft text-forest-fg">
                  <MessageCircle className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{label(m.template)}</p>
                  <p className="truncate text-xs text-ink-muted tabular-nums">
                    {phone(m.to_phone)} · {when(m.created_at)}
                  </p>
                  {m.error && m.status !== "sent" && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-alert">
                      <AlertTriangle className="size-3 shrink-0" />
                      {m.error}
                    </p>
                  )}
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONE[m.status] ?? "bg-khaki-soft text-ink-muted")}>
                  {m.status === "pending" ? "In queue" : m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                  {(m.attempts ?? 0) > 1 && ` · ${m.attempts}×`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cn(card, "p-4 sm:p-5")}>
        <header className="mb-3 flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-khaki-soft text-forest-fg">
            <BellOff className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-forest-text">Stop messages to a number</h2>
            <p className="text-xs text-ink-muted">Use when a customer asks not to get WhatsApp messages.</p>
          </div>
        </header>
        <form
          action={(form) =>
            run(async () => {
              const p = String(form.get("phone") ?? "").replace(/\D/g, "").slice(-10);
              if (!/^[6-9]\d{9}$/.test(p)) throw new Error("Enter a valid 10-digit mobile number.");
              unwrap(await optOutWhatsAppAction({ phone: p }));
              return `+91 ${p} will not get WhatsApp messages`;
            }, "Saved")
          }
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label className="flex h-10 flex-1 items-center rounded-full border border-line bg-surface focus-within:border-forest-fg sm:max-w-sm">
            <span className="border-r border-line px-3.5 text-sm text-ink-muted">+91</span>
            <span className="sr-only">Mobile number</span>
            <input name="phone" inputMode="numeric" maxLength={14} placeholder="Mobile number" className="h-full min-w-0 flex-1 rounded-r-full bg-transparent px-3 text-sm text-ink outline-none" />
          </label>
          <button disabled={pending} className="h-10 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-60">
            Stop messages
          </button>
        </form>
      </section>
    </div>
  );
}
