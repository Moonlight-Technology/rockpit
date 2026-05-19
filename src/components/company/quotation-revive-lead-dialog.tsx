"use client";

type Props = {
  open: boolean;
  prospectName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function QuotationReviveLeadDialog({
  open,
  prospectName,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <h3 className="text-lg font-semibold">Lead is marked Lost</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {prospectName} was previously marked as Lost. Creating a new quotation will move
          it back to the &quot;Negotiation&quot; column.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            Revive &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
