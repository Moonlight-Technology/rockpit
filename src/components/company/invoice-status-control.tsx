"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED";

export function InvoiceStatusControl({
  invoiceId,
  currentStatus,
}: {
  invoiceId: string;
  currentStatus: InvoiceStatus;
}) {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const isDirty = selectedStatus !== currentStatus;

  async function handleUpdate() {
    if (!isDirty || isPending) {
      return;
    }

    const response = await fetch(`/api/companies/${companyId}/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: selectedStatus }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      toast.error(result?.error?.message ?? "Unable to update invoice status.");
      setSelectedStatus(currentStatus);
      return;
    }

    toast.success(`Invoice status updated to ${selectedStatus}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-end gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</span>
        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value as InvoiceStatus)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
          disabled={isPending}
        >
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!isDirty || isPending}
        onClick={handleUpdate}
        className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Updating..." : "Update status"}
      </button>
    </div>
  );
}
