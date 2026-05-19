"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { QuotationEditor } from "@/components/company/quotation-editor";
import { QuotationReviveLeadDialog } from "@/components/company/quotation-revive-lead-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type LeadStage = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

type Props = {
  leadId: string;
  prospectName: string;
  leadStage: LeadStage;
  triggerLabel?: string;
};

export function QuotationEditorSheet({
  leadId,
  prospectName,
  leadStage,
  triggerLabel = "Create quotation",
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reviveDialogOpen, setReviveDialogOpen] = useState(false);
  const [reviveConfirmed, setReviveConfirmed] = useState(false);

  function onTriggerClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (leadStage === "LOST" && !reviveConfirmed) {
      event.preventDefault();
      setReviveDialogOpen(true);
    }
  }

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              onClick={onTriggerClick}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Plus className="size-4" />
              {triggerLabel}
            </button>
          }
        />
        <SheetContent
          side="right"
          className="w-full overflow-y-auto data-[side=right]:sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Create quotation for {prospectName}</SheetTitle>
            <SheetDescription>
              The first quotation starts a numbered series. Saving again later from the
              detail page creates the next revision.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <QuotationEditor
              leadId={leadId}
              title=""
              description=""
              submitLabel="Create quotation"
              reviveLead={leadStage === "LOST" && reviveConfirmed}
              bare
            />
          </div>
        </SheetContent>
      </Sheet>

      <QuotationReviveLeadDialog
        open={reviveDialogOpen}
        prospectName={prospectName}
        onCancel={() => setReviveDialogOpen(false)}
        onConfirm={() => {
          setReviveConfirmed(true);
          setReviveDialogOpen(false);
          setSheetOpen(true);
        }}
      />
    </>
  );
}
