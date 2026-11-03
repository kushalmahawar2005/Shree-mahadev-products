import { cn } from "@/lib/utils/cn";

export function PageHeader({ title, intro, action }: { title: string; intro?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold text-forest-text">{title}</h1>
        {intro && <p className="mt-1 text-ink-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-white p-5", className)}>
      {title && <h2 className="mb-4 text-lg font-bold text-forest-text">{title}</h2>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold text-forest-text">{value}</p>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
    </div>
  );
}

const tones: Record<string, string> = {
  green: "bg-forest/10 text-forest",
  amber: "bg-mustard/20 text-sale",
  red: "bg-red-100 text-red-800",
  gray: "bg-black/5 text-ink-muted",
};

export function StatusBadge({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export const statusTone = (s: string) =>
  ({ Paid: "green", Delivered: "green", Shipped: "amber", COD: "amber", New: "amber", Contacted: "gray", Closed: "gray", Cancelled: "red" })[s] ?? "gray";

/** Horizontally scrollable table wrapper (mobile friendly). */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="border-b border-line bg-khaki-soft/60 text-sm text-ink-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest-text">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "min-h-11 w-full rounded-xl border border-line bg-white px-4 text-ink focus:border-forest focus:outline-none";

export function MockSave({ label = "Save changes" }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled className="min-h-11 rounded-full bg-forest px-6 font-semibold text-white disabled:opacity-50">
        {label}
      </button>
      <span className="text-sm text-ink-muted">Not connected yet. This page still uses sample data.</span>
    </div>
  );
}
