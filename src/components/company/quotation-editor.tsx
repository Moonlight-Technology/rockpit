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
  bare?: boolean;
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
  bare = false,
}: QuotationEditorProps) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<QuotationStatus>(initialStatus);
  const [lines, setLines] = useState(() => (initialLines?.length ? initialLines : [emptyLine]));
  const [error, setError] = useState<string | null>(null);
  const isBusy = isSubmitting || isPending;

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }
    setError(null);
    setIsSubmitting(true);

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
      setIsSubmitting(false);
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
      className={
        bare
          ? "text-card-foreground"
          : "rounded-[28px] border border-border bg-card p-5 text-card-foreground"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {title || description ? (
          <div>
            {title ? (
              <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as QuotationStatus)}
            disabled={isBusy}
            className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
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
            key={index}
            className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4"
          >
            <label className="grid gap-1 text-sm">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </span>
              <input
                value={line.description}
                disabled={isBusy}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item
                    )
                  )
                }
                className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
                placeholder="Landing page design and implementation"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Qty
                </span>
                <input
                  type="number"
                  min={1}
                  value={line.quantity}
                  disabled={isBusy}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, quantity: Number(event.target.value || 0) }
                          : item
                      )
                    )
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Unit price
                </span>
                <input
                  type="number"
                  min={0}
                  value={line.unitPrice}
                  disabled={isBusy}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, unitPrice: Number(event.target.value || 0) }
                          : item
                      )
                    )
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Line total
                </span>
                <div className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Rp{(line.quantity * line.unitPrice).toLocaleString("id-ID")}
                </div>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  disabled={isBusy || lines.length === 1}
                  onClick={() =>
                    setLines((current) =>
                      current.length === 1
                        ? current
                        : current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="rounded-xl border border-rose-300/20 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setLines((current) => [...current, emptyLine])}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add line
        </button>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold text-card-foreground">Rp{subtotal.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-full disabled:opacity-60"
        >
          {isBusy ? "Saving..." : submitLabel}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </form>
  );
}
