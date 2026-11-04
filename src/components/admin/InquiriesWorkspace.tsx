"use client";

import { useMemo, useState, useTransition } from "react";
import { INDIAN_STATES } from "@/lib/checkout";
import {
  addInquiryNoteAction,
  createManualInquiryOrderAction,
  updateInquiryDetailsAction,
  updateInquiryStatusAction,
} from "@/lib/inquiry-actions";
import { INQUIRY_STATUSES, type Inquiry, type InquiryStatus } from "@/lib/inquiry-types";
import { formatMoney } from "@/lib/utils/money";
import { Card, StatusBadge, Table, inputCls } from "@/components/admin/ui";

type VariantChoice = { variantKey: string; title: string; price: number };
const STAGE: Record<
  InquiryStatus,
  { label: string; tone: "gray" | "amber" | "green" | "red" }
> = {
  new: { label: "New", tone: "amber" },
  contacted: { label: "Contacted", tone: "gray" },
  quoted: { label: "Quote sent", tone: "amber" },
  won: { label: "Won", tone: "green" },
  lost: { label: "Lost", tone: "red" },
};

export function InquiriesWorkspace({
  initialInquiries,
  variants,
  initialFilter,
  today,
}: {
  initialInquiries: Inquiry[];
  variants: VariantChoice[];
  initialFilter: "all" | "due";
  today: string;
}) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [mode, setMode] = useState<"board" | "table">("board");
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      inquiries.filter((inquiry) => {
        const matchesQuery =
          `${inquiry.name} ${inquiry.business} ${inquiry.city} ${inquiry.phone} ${inquiry.product}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const due =
          inquiry.followUpAt &&
          inquiry.followUpAt <= today &&
          inquiry.status !== "won" &&
          inquiry.status !== "lost";
        return matchesQuery && (filter === "all" || due);
      }),
    [inquiries, query, filter, today],
  );

  function move(id: number, status: InquiryStatus) {
    const previous = inquiries;
    setInquiries((rows) =>
      rows.map((row) => (row.id === id ? { ...row, status } : row)),
    );
    setNotice("");
    startTransition(async () => {
      const result = await updateInquiryStatusAction({ id, status });
      if (!result.ok) {
        setInquiries(previous);
        setNotice(result.error ?? "Could not update inquiry.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-sm font-semibold text-forest-text">
              Search inquiries
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, business, phone or product"
              className={inputCls}
            />
          </label>
          <div
            className="flex min-h-11 gap-2"
            role="group"
            aria-label="Inquiry view"
          >
            <button
              type="button"
              onClick={() => setFilter("all")}
              aria-pressed={filter === "all"}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${filter === "all" ? "border-forest bg-forest text-white" : "border-line"}`}
            >
              All leads
            </button>
            <button
              type="button"
              onClick={() => setFilter("due")}
              aria-pressed={filter === "due"}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${filter === "due" ? "border-forest bg-forest text-white" : "border-line"}`}
            >
              Follow-ups due
            </button>
          </div>
          <div className="flex min-h-11 gap-2" role="group" aria-label="Layout">
            <button
              type="button"
              onClick={() => setMode("board")}
              aria-pressed={mode === "board"}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${mode === "board" ? "border-forest bg-forest text-white" : "border-line"}`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={() => setMode("table")}
              aria-pressed={mode === "table"}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${mode === "table" ? "border-forest bg-forest text-white" : "border-line"}`}
            >
              Table
            </button>
          </div>
        </div>
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-sale">
          {notice || (pending ? "Saving…" : "")}
        </p>
      </Card>

      {mode === "board" ? (
        <div className="grid items-start gap-3 xl:grid-cols-5">
          {INQUIRY_STATUSES.map((status) => {
            const rows = visible.filter((inquiry) => inquiry.status === status);
            return (
              <section
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = Number(event.dataTransfer.getData("text/plain"));
                  if (id) move(id, status);
                }}
                className="min-h-56 rounded-2xl bg-khaki-soft/60 p-3"
              >
                <header className="mb-3 flex items-center justify-between gap-2 px-1">
                  <h2 className="font-semibold text-forest-text">
                    {STAGE[status].label}
                  </h2>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-ink-muted">
                    {rows.length}
                  </span>
                </header>
                <div className="space-y-3">
                  {rows.map((inquiry) => (
                    <InquiryCard
                      key={inquiry.id}
                      inquiry={inquiry}
                      variants={variants}
                      onMove={move}
                    />
                  ))}
                  {!rows.length && (
                    <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted">
                      Drop an inquiry here
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Table
          head={[
            "Lead",
            "Business",
            "Request",
            "Stage",
            "Follow-up",
            "Details",
          ]}
        >
          {visible.map((inquiry) => (
            <tr key={inquiry.id}>
              <td>
                <strong>{inquiry.name}</strong>
                <span className="block text-sm text-ink-muted">
                  {inquiry.phone} · {inquiry.createdAt.slice(0, 10)}
                </span>
              </td>
              <td>
                {inquiry.business || "—"}
                <span className="block text-sm text-ink-muted">
                  {inquiry.city}
                </span>
              </td>
              <td>
                {inquiry.product}
                <span className="block text-sm text-ink-muted">
                  {inquiry.quantity}
                </span>
              </td>
              <td>
                <select
                  aria-label={`Stage for ${inquiry.name}`}
                  value={inquiry.status}
                  onChange={(event) =>
                    move(inquiry.id, event.target.value as InquiryStatus)
                  }
                  className="min-h-11 rounded-xl border border-line bg-white px-3"
                >
                  {INQUIRY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STAGE[status].label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="whitespace-nowrap">{inquiry.followUpAt || "—"}</td>
              <td>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest">
                    Open lead
                  </summary>
                  <div className="min-w-64 space-y-4 py-2">
                    <LeadDetails
                      inquiry={inquiry}
                      variants={variants}
                      onMove={move}
                    />
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {!visible.length && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">
          No bulk inquiries match this view.
        </p>
      )}
      <p className="text-sm text-ink-muted">
        Showing up to 500 recent bulk inquiries. Drag cards between stages or
        use the stage controls.
      </p>
    </div>
  );
}

function InquiryCard({
  inquiry,
  variants,
  onMove,
}: {
  inquiry: Inquiry;
  variants: VariantChoice[];
  onMove: (id: number, status: InquiryStatus) => void;
}) {
  return (
    <article
      draggable
      onDragStart={(event) =>
        event.dataTransfer.setData("text/plain", String(inquiry.id))
      }
      className="rounded-2xl border border-line bg-white p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-forest-text">
            {inquiry.name}
          </h3>
          <p className="truncate text-sm text-ink-muted">
            {inquiry.business || inquiry.city}
          </p>
        </div>
        <StatusBadge tone={STAGE[inquiry.status].tone}>
          {STAGE[inquiry.status].label}
        </StatusBadge>
      </div>
      <p className="mt-3 text-sm">
        {inquiry.product} · {inquiry.quantity}
      </p>
      {inquiry.quoteAmount !== null && (
        <p className="mt-1 text-sm font-semibold text-forest">
          Quote {formatMoney(inquiry.quoteAmount)}
        </p>
      )}
      {inquiry.followUpAt && (
        <p className="mt-1 text-sm text-ink-muted">
          Follow-up: {inquiry.followUpAt}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`tel:+91${inquiry.phone}`}
          className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-semibold text-forest"
        >
          Call
        </a>
        <a
          href={`https://wa.me/91${inquiry.phone}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-semibold text-forest"
        >
          WhatsApp
        </a>
        <details className="w-full">
          <summary className="min-h-11 cursor-pointer rounded-full border border-line px-4 py-2 text-center text-sm font-semibold text-forest">
            Lead details
          </summary>
          <div className="mt-3 space-y-4 border-t border-line pt-3">
            <LeadDetails
              inquiry={inquiry}
              variants={variants}
              onMove={onMove}
            />
          </div>
        </details>
      </div>
    </article>
  );
}

function LeadDetails({
  inquiry,
  variants,
  onMove,
}: {
  inquiry: Inquiry;
  variants: VariantChoice[];
  onMove: (id: number, status: InquiryStatus) => void;
}) {
  const [assignee, setAssignee] = useState(inquiry.assignee);
  const [followUpAt, setFollowUpAt] = useState(inquiry.followUpAt);
  const [quoteAmount, setQuoteAmount] = useState(
    inquiry.quoteAmount === null ? "" : String(inquiry.quoteAmount),
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveDetails() {
    startTransition(async () => {
      const result = await updateInquiryDetailsAction({
        id: inquiry.id,
        assignee,
        followUpAt,
        quoteAmount: quoteAmount === "" ? null : Number(quoteAmount),
      });
      setMessage(result.ok ? "Saved." : (result.error ?? "Could not save."));
    });
  }

  function saveNote() {
    startTransition(async () => {
      const result = await addInquiryNoteAction({ id: inquiry.id, body: note });
      if (result.ok) setNote("");
      setMessage(
        result.ok ? "Note added." : (result.error ?? "Could not save note."),
      );
    });
  }

  return (
    <>
      <p className="text-sm text-ink-muted">
        {inquiry.phone}
        {inquiry.email ? ` · ${inquiry.email}` : ""}
        <br />
        {inquiry.city} · {inquiry.createdAt.slice(0, 16)}
      </p>
      {inquiry.message && (
        <p className="whitespace-pre-wrap rounded-xl bg-khaki-soft p-3 text-sm">
          {inquiry.message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Assignee
          <input
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            maxLength={60}
            placeholder="Team member"
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold">
          Follow-up date
          <input
            type="date"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Quote amount (₹)
          <input
            type="number"
            min="0"
            max="100000000"
            step="1"
            value={quoteAmount}
            onChange={(event) => setQuoteAmount(event.target.value)}
            placeholder="Optional"
            className={`${inputCls} mt-1`}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={saveDetails}
        className="min-h-11 rounded-full bg-forest px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        Save lead details
      </button>
      <section>
        <h4 className="font-semibold text-forest-text">Notes timeline</h4>
        {inquiry.notes.length ? (
          <ol className="mt-2 space-y-2">
            {inquiry.notes.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-khaki-soft p-3 text-sm"
              >
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {item.author} · {item.createdAt.slice(0, 16)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">No notes yet.</p>
        )}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Add a call note or next step"
          className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={saveNote}
          className="mt-2 min-h-11 rounded-full border border-forest px-4 text-sm font-semibold text-forest disabled:opacity-50"
        >
          Add note
        </button>
      </section>
      <div>
        <p className="mb-2 text-sm font-semibold text-forest-text">
          Move to a stage
        </p>
        <div className="flex flex-wrap gap-2">
          {INQUIRY_STATUSES.filter((status) => status !== inquiry.status).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => onMove(inquiry.id, status)}
                className="min-h-11 rounded-full border border-line px-3 text-sm hover:border-forest"
              >
                {STAGE[status].label}
              </button>
            ),
          )}
        </div>
      </div>
      {inquiry.status === "won" && (
        <ManualOrderForm inquiry={inquiry} variants={variants} />
      )}
      {message && (
        <p aria-live="polite" className="text-sm text-ink-muted">
          {message}
        </p>
      )}
    </>
  );
}

function ManualOrderForm({
  inquiry,
  variants,
}: {
  inquiry: Inquiry;
  variants: VariantChoice[];
}) {
  const first = variants[0];
  const [items, setItems] = useState([
    {
      variantKey: first?.variantKey ?? "",
      quantity: 1,
      unitPrice: first?.price ?? 1,
    },
  ]);
  const [method, setMethod] = useState<"cod" | "offline">("cod");
  const [shipping, setShipping] = useState("0");
  const [name, setName] = useState(inquiry.name);
  const [phone, setPhone] = useState(inquiry.phone);
  const [email, setEmail] = useState(inquiry.email);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(inquiry.city);
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createManualInquiryOrderAction({
        inquiryId: inquiry.id,
        name,
        phone,
        email,
        line1,
        line2,
        city,
        state,
        pincode,
        method,
        shipping: Number(shipping),
        items,
      });
      setMessage(
        result.ok
          ? `Created order ${result.orderNo}. Open it in Orders to review the address and shipping.`
          : (result.error ?? "Could not create the order."),
      );
    });
  }

  if (!variants.length)
    return (
      <p className="text-sm text-sale">
        No in-stock products are available to add to this order.
      </p>
    );
  return (
    <details className="rounded-2xl border border-forest/20 p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-forest">
        Create manual order
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink-muted">
          Prices below are custom per-unit prices. Stock is reserved when you
          create the order.
        </p>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_120px_auto]"
            >
              <select
                aria-label={`Product line ${index + 1}`}
                value={item.variantKey}
                onChange={(event) => {
                  const variant = variants.find(
                    (choice) => choice.variantKey === event.target.value,
                  );
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? {
                            ...line,
                            variantKey: event.target.value,
                            unitPrice: variant?.price ?? line.unitPrice,
                          }
                        : line,
                    ),
                  );
                }}
                className="min-h-11 min-w-0 rounded-xl border border-line bg-white px-3"
              >
                {variants.map((variant) => (
                  <option key={variant.variantKey} value={variant.variantKey}>
                    {variant.title}
                  </option>
                ))}
              </select>
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max="100"
                value={item.quantity}
                onChange={(event) =>
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? { ...line, quantity: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
                className="min-h-11 rounded-xl border border-line px-3"
              />
              <input
                aria-label="Custom unit price"
                type="number"
                min="1"
                step="1"
                value={item.unitPrice}
                onChange={(event) =>
                  setItems((lines) =>
                    lines.map((line, i) =>
                      i === index
                        ? { ...line, unitPrice: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
                className="min-h-11 rounded-xl border border-line px-3"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setItems((lines) => lines.filter((_, i) => i !== index))
                  }
                  className="min-h-11 rounded-full border border-line px-3 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (first && items.length < 20)
              setItems((lines) => [
                ...lines,
                {
                  variantKey: first.variantKey,
                  quantity: 1,
                  unitPrice: first.price,
                },
              ]);
          }}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
        >
          Add product
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Customer name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Address line 1
            <input
              value={line1}
              onChange={(event) => setLine1(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Address line 2
            <input
              value={line2}
              onChange={(event) => setLine2(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            State
            <select
              value={state}
              onChange={(event) => setState(event.target.value)}
              className={`${inputCls} mt-1`}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            PIN code
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Shipping charged (₹)
            <input
              type="number"
              min="0"
              value={shipping}
              onChange={(event) => setShipping(event.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="text-sm font-semibold">
            Payment
            <select
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as "cod" | "offline")
              }
              className={`${inputCls} mt-1`}
            >
              <option value="cod">Cash on delivery</option>
              <option value="offline">Paid offline</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={create}
          className="min-h-11 w-full rounded-full bg-forest px-4 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Creating order…" : "Create order and take stock"}
        </button>
        {message && (
          <p aria-live="polite" className="text-sm text-ink-muted">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
