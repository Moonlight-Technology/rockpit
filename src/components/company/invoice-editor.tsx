"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type InvoiceEditorProps = {
  quotationId: string;
  initialLines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  quotationLabel: string;
  prospectName: string;
};

const emptyLine = {
  description: "",
  quantity: 1,
  unitPrice: 0,
};

export function InvoiceEditor({
  quotationId,
  initialLines,
  quotationLabel,
  prospectName,
}: InvoiceEditorProps) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lines, setLines] = useState(() => (initialLines.length ? initialLines : [emptyLine]));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isBusy = isPending || isSubmitting;

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/companies/${companyId}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quotationId,
        lines,
        notes,
      }),
    });

    const result = await response.json().catch(() => null);
    setIsSubmitting(false);

    if (!response.ok || !result?.ok) {
      const message = result?.error?.message ?? "Unable to create invoice.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(`Invoice created from ${quotationLabel}.`);
    startTransition(() => {
      router.push(`/company/${companyId}/invoices/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-border bg-card p-5 text-card-foreground"
    >
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Create invoice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start from approved quotation {quotationLabel} for {prospectName}.
        </p>
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
                placeholder="DP tahap 1"
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

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setLines((current) => [...current, emptyLine])}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add line
        </button>

        <div className="min-w-[240px] rounded-2xl border border-border bg-muted/30 p-4 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold text-card-foreground">
            Rp{subtotal.toLocaleString("id-ID")}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
          <p className="text-lg font-semibold text-card-foreground">
            Rp{subtotal.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <label className="mt-5 grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</span>
        <textarea
          value={notes}
          disabled={isBusy}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="rounded-2xl border border-border bg-background px-3 py-3 text-foreground outline-none"
          placeholder="Optional billing note, milestone summary, or delivery context."
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isBusy}
          className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? "Creating..." : "Create invoice"}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </form>
  );
}
