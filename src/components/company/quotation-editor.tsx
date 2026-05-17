"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

type QuotationEditorProps = {
  leadId: string;
  quotationId?: string;
  initialStatus?: QuotationStatus;
  initialLines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  title?: string;
  description?: string;
  submitLabel?: string;
};

const emptyLine = {
  description: "",
  quantity: 1,
  unitPrice: 0,
};

export function QuotationEditor({
  leadId,
  quotationId,
  initialStatus = "DRAFT",
  initialLines,
  title = "Quotation editor",
  description = "Build line items and create a new quotation revision.",
  submitLabel = "Save quotation",
}: QuotationEditorProps) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<QuotationStatus>(initialStatus);
  const [lines, setLines] = useState(() => (initialLines?.length ? initialLines : [emptyLine]));
  const [error, setError] = useState<string | null>(null);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const endpoint = quotationId
      ? `/api/companies/${companyId}/quotations/${quotationId}`
      : `/api/companies/${companyId}/quotations`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        status,
        lines,
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error?.message ?? "Unable to save quotation.");
      return;
    }

    startTransition(() => {
      router.push(`/company/${companyId}/quotations/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-white/10 bg-white/6 p-5 text-slate-100 ring-1 ring-white/5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as QuotationStatus)}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
          >
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.description}`}
            className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 md:grid-cols-[minmax(0,1.8fr)_120px_140px_auto]"
          >
            <label className="grid gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Description
              </span>
              <input
                value={line.description}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item
                    )
                  )
                }
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                placeholder="Landing page design and implementation"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Qty</span>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, quantity: Number(event.target.value || 0) }
                        : item
                    )
                  )
                }
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Unit price
              </span>
              <input
                type="number"
                min={0}
                value={line.unitPrice}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, unitPrice: Number(event.target.value || 0) }
                        : item
                    )
                  )
                }
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>

            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
                Rp{(line.quantity * line.unitPrice).toLocaleString("id-ID")}
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
                }
                className="rounded-xl border border-rose-300/20 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-400/10"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLines((current) => [...current, emptyLine])}
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10"
        >
          Add line
        </button>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subtotal</p>
          <p className="text-lg font-semibold text-white">Rp{subtotal.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </form>
  );
}
