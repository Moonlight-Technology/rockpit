"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { QuotationEditor } from "@/components/company/quotation-editor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type QuotationEditorSheetProps = {
  leadId: string;
  prospectName: string;
  triggerLabel?: string;
};

export function QuotationEditorSheet({
  leadId,
  prospectName,
  triggerLabel = "Create quotation",
}: QuotationEditorSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
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
            The first quotation starts a numbered series. Saving again later
            from the detail page creates the next revision.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <QuotationEditor
            leadId={leadId}
            title=""
            description=""
            submitLabel="Create quotation"
            bare
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
