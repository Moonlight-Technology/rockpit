"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CompanyUnlockDialogProps = {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => Promise<void> | void;
};

export function CompanyUnlockDialog({
  open,
  onClose,
  onUnlocked,
}: CompanyUnlockDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/company/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setError(result?.error?.message ?? "Failed to unlock company mode.");
        return;
      }

      setCode("");
      onClose();
      await onUnlocked();
    } catch {
      setError("Failed to unlock company mode.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unlock Company Mode</CardTitle>
          <CardDescription>
            Enter your premium code to enable company workspaces on this account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter premium code"
            className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCode("");
                setError(null);
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
              {submitting ? "Unlocking..." : "Unlock"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
