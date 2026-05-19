"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

type QuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

type Props = {
  quotationId: string;
  currentStatus: QuotationStatus;
  prospectName: string;
  quotationLabel: string;
  disabled?: boolean;
};

export function QuotationStatusControl({
  quotationId,
  currentStatus,
  prospectName,
  quotationLabel,
  disabled = false,
}: Props) {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [pendingStatus, setPendingStatus] = useState<QuotationStatus>(currentStatus);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, startTransition] = useTransition();
  const isDirty = pendingStatus !== currentStatus;

  async function submit(status: QuotationStatus) {
    setIsSaving(true);
    const response = await fetch(
      `/api/companies/${companyId}/quotations/${quotationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    const result = await response.json().catch(() => null);
    setIsSaving(false);

    if (!response.ok || !result?.ok) {
      toast.error(result?.error?.message ?? "Unable to update status.");
      setPendingStatus(currentStatus);
      return;
    }

    if (status === "APPROVED") {
      const wonMissing = (result.warnings ?? []).some(
        (w: { code: string }) => w.code === "WON_COLUMN_MISSING"
      );
      toast.success(
        wonMissing
          ? `${quotationLabel} approved. Note: 'Won' column missing — move the lead manually.`
          : `${quotationLabel} approved. ${prospectName} moved to Won.`
      );
    } else {
      toast.success(`Status updated to ${status}.`);
    }

    startTransition(() => router.refresh());
  }

  function onClickUpdate() {
    if (!isDirty || isSaving) return;
    if (pendingStatus === "APPROVED") {
      setShowApproveConfirm(true);
      return;
    }
    submit(pendingStatus);
  }

  return (
    <div className="flex items-end gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Status
        </span>
        <select
          value={pendingStatus}
          disabled={disabled || isSaving}
          onChange={(event) => setPendingStatus(event.target.value as QuotationStatus)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none"
        >
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!isDirty || disabled || isSaving}
        onClick={onClickUpdate}
        className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Update status"}
      </button>

      {showApproveConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowApproveConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg"
          >
            <h3 className="text-lg font-semibold">Approve quotation?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Approving {quotationLabel} will mark lead &quot;{prospectName}&quot; as Won and
              move it to the &quot;Won&quot; column.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  setPendingStatus(currentStatus);
                }}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  submit("APPROVED");
                }}
                className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
